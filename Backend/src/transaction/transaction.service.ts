import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentStatus, Role, TransactionStatus } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) { }

  // =====================================================
  // CREATE (Zimmet Oluştur)
  // =====================================================
  async create(
    dto: { documentNumber: string; toUserId: string },
    fromUserId: string,
  ) {
    const documentNumber = String(dto.documentNumber).trim();
    const toUserId = dto.toUserId;

    // 1) Evrak no validasyonu
    if (!/^[0-9]+$/.test(documentNumber)) {
      throw new BadRequestException('Evrak numarası sadece rakam olmalı');
    }

    // 2) Temel kontroller
    if (!documentNumber) {
      throw new BadRequestException('Evrak numarası zorunludur');
    }
    if (!toUserId) {
      throw new BadRequestException('Hedef kullanıcı zorunludur');
    }
    if (toUserId === fromUserId) {
      throw new BadRequestException('Kendine zimmet gönderemezsin');
    }

    return this.prisma.$transaction(async (tx) => {
      // 3) Evrak var mı? Yoksa OLUŞTUR (upsert ile)
      const doc = await tx.document.upsert({
        where: { number: documentNumber },
        update: {},
        create: {
          number: documentNumber,
          currentHolderId: fromUserId, // ilk oluşturan "sende" kabul edilebilir
          status: DocumentStatus.ACTIVE,
        },
        select: {
          number: true,
          currentHolderId: true,
          status: true,
          archivedByUserId: true,
        },
      });

      // doc upsert'ten sonra, pending kontrolünden ÖNCE:
      await tx.$queryRaw`
        SELECT 1
        FROM "Document"
        WHERE "number" = ${documentNumber}
        FOR UPDATE
      `;

      const currentUser = await tx.user.findUnique({
        where: { id: fromUserId },
        select: { id: true, role: true },
      });

      if (!currentUser) {
        throw new NotFoundException('Kullanıcı bulunamadı');
      }

      // 4) ARŞİVDEN ÇIKARMA KONTROLÜ
      if (doc.status === DocumentStatus.ARCHIVED) {
        const isArchiver = doc.archivedByUserId === fromUserId;
        const isAdmin = currentUser.role === Role.ADMIN;
        if (!isArchiver && !isAdmin) {
          throw new BadRequestException(
            'Bu evrak arşivlenmiş. Yeni zimmet oluşturulamaz.',
          );
        }
        await tx.document.update({
          where: { number: documentNumber },
          data: { status: DocumentStatus.ACTIVE },
        });
      }

      // 5) Aynı evrak için BEKLEYEN zimmet var mı?
      const pending = await tx.transaction.findFirst({
        where: {
          documentNumber,
          status: TransactionStatus.PENDING,
        },
        select: { id: true },
      });

      if (pending) {
        throw new BadRequestException(
          'Bu evrak için zaten bekleyen bir zimmet var',
        );
      }

      // 6) Aynı kişiye ÜST ÜSTE zimmet engeli
      const lastTx = await tx.transaction.findFirst({
        where: { documentNumber },
        orderBy: { createdAt: 'desc' },
      });

      if (
        lastTx &&
        lastTx.toUserId === toUserId &&
        lastTx.status !== TransactionStatus.REJECTED &&
        lastTx.status !== TransactionStatus.RETURNED
      ) {
        throw new BadRequestException(
          'Bu evrak zaten bu kullanıcıya zimmetlenmiş',
        );
      }

      // 7) Yetki: Sadece mevcut sahibi zimmetleyebilir
      if (doc.currentHolderId && doc.currentHolderId !== fromUserId) {
        throw new ForbiddenException(
          'Bu evrak sende değil. Sadece evrakın mevcut sahibi zimmetleyebilir.',
        );
      }

      // 8) Hedef kullanıcı aktif mi?
      const toUser = await tx.user.findUnique({
        where: { id: toUserId },
        select: { id: true, isActive: true },
      });

      if (!toUser) {
        throw new NotFoundException('Hedef kullanıcı bulunamadı');
      }
      if (!toUser.isActive) {
        throw new BadRequestException(
          'Pasif kullanıcıya zimmet gönderemezsin',
        );
      }

      // 9) Transaction oluştur
      const created = await tx.transaction.create({
        data: {
          documentNumber,
          fromUserId,
          toUserId,
          status: TransactionStatus.PENDING,
        },
        include: {
          fromUser: {
            select: { id: true, fullName: true, department: true },
          },
          toUser: {
            select: { id: true, fullName: true, department: true },
          },
        },
      });

      return created;
    });
  }

  // =====================================================
  // LIST (Benim Geçmişim)
  // =====================================================
  async myList(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: { select: { id: true, fullName: true, department: true } },
        toUser: { select: { id: true, fullName: true, department: true } },
      },
    });

    const documentNumbers = Array.from(
      new Set(transactions.map((tx) => tx.documentNumber)),
    );

    if (documentNumbers.length === 0) {
      return transactions;
    }

    const documents = documentNumbers.length
      ? await this.prisma.document.findMany({
        where: { number: { in: documentNumbers } },
        select: {
          number: true,
          status: true,
        },
      })
      : [];

    const docMap = new Map(documents.map((doc) => [doc.number, doc]));

    const groupedByDoc = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const existing = groupedByDoc.get(tx.documentNumber);
      if (existing) {
        existing.push(tx);
      } else {
        groupedByDoc.set(tx.documentNumber, [tx]);
      }
    }

    const activeAcceptIds = new Set<string>();

    for (const [docNumber, txs] of groupedByDoc.entries()) {
      const sorted = [...txs].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      for (const tx of sorted) {
        const isAcceptedByUser =
          tx.status === TransactionStatus.ACCEPTED &&
          tx.toUserId === userId;

        if (!isAcceptedByUser) continue;

        const txCreatedAt = new Date(tx.createdAt).getTime();
        const hasLaterOutTx = sorted.some((other) => {
          if (other.id === tx.id) return false;
          if (other.fromUserId !== userId) return false;
          const otherCreatedAt = new Date(other.createdAt).getTime();
          return otherCreatedAt > txCreatedAt;
        });

        if (!hasLaterOutTx) {
          activeAcceptIds.add(tx.id);
        }
      }
    }

    return transactions.map((tx) => ({
      ...tx,
      document: docMap.get(tx.documentNumber)
        ? {
            status: docMap.get(tx.documentNumber)?.status,
          }
        : undefined,
      isActiveForMe: activeAcceptIds.has(tx.id),
    }));
  }

  // =====================================================
  // DOCUMENT TIMELINE
  // =====================================================
  async listByDocument(number: string) {
    const [doc, transactions] = await Promise.all([
      this.prisma.document.findUnique({
        where: { number },
        select: {
          status: true,
          archivedAt: true,
          archivedBy: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.transaction.findMany({
        where: { documentNumber: number },
        orderBy: { createdAt: 'asc' },
        include: {
          fromUser: { select: { id: true, fullName: true, department: true } },
          toUser: { select: { id: true, fullName: true, department: true } },
        },
      }),
    ]);

    const items: Array<{
      type: string;
      id?: string;
      createdAt: string;
      fromUser?: { id: string; fullName: string; department: string | null };
      toUser?: { id: string; fullName: string; department: string | null };
      user?: { id: string; fullName: string };
      status?: string;
    }> = transactions.map((tx) => ({
      type: 'TRANSACTION',
      id: tx.id,
      createdAt: tx.createdAt.toISOString(),
      fromUser: tx.fromUser ?? undefined,
      toUser: tx.toUser ?? undefined,
      status: tx.status,
    }));

    if (doc?.archivedAt && doc.archivedBy) {
      items.push({
        type: 'ARCHIVED',
        createdAt: doc.archivedAt.toISOString(),
        user: doc.archivedBy,
      });
    }

    if (
      doc?.status === DocumentStatus.ACTIVE &&
      doc?.archivedAt &&
      doc?.archivedBy
    ) {
      const archivedAt = doc.archivedAt.getTime();
      const firstAfter = transactions.find(
        (tx) => new Date(tx.createdAt).getTime() > archivedAt,
      );
      if (firstAfter) {
        const txTime = new Date(firstAfter.createdAt).getTime();
        items.push({
          type: 'UNARCHIVED',
          createdAt: new Date(txTime - 1).toISOString(),
          user: doc.archivedBy,
        });
      }
    }

    items.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return items;
  }

  // =====================================================
  // ACCEPT
  // =====================================================
  async accept(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findUnique({ where: { id } });

      if (!t) throw new NotFoundException('Zimmet bulunamadı');
      if (t.status !== TransactionStatus.PENDING)
        throw new BadRequestException('Sadece bekleyen zimmet kabul edilir');
      if (t.toUserId !== userId)
        throw new ForbiddenException('Bu zimmet sana ait değil');

      await tx.transaction.update({
        where: { id },
        data: { status: TransactionStatus.ACCEPTED },
      });

      await tx.document.update({
        where: { number: t.documentNumber },
        data: { currentHolderId: userId },
      });

      return { message: 'Zimmet kabul edildi' };
    });
  }

  // =====================================================
  // REJECT
  // =====================================================
  async reject(id: string, userId: string) {
    const t = await this.prisma.transaction.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Zimmet bulunamadı');
    if (t.status !== TransactionStatus.PENDING)
      throw new BadRequestException('Sadece bekleyen zimmet reddedilir');
    if (t.toUserId !== userId)
      throw new ForbiddenException('Bu zimmet sana ait değil');

    return this.prisma.transaction.update({
      where: { id },
      data: { status: TransactionStatus.REJECTED },
    });
  }

  // =====================================================
  // CANCEL (Gönderen geri çeker)
  // =====================================================
  async cancel(id: string, userId: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Zimmet bulunamadı');
    if (tx.fromUserId !== userId)
      throw new ForbiddenException('Sadece gönderen iptal edebilir');
    if (tx.status !== TransactionStatus.PENDING)
      throw new BadRequestException('Kabul edilmiş zimmet iptal edilemez');

    return this.prisma.transaction.update({
      where: { id },
      data: { status: TransactionStatus.CANCELLED },
    });
  }

  // =====================================================
  // RETURN (İade)
  // =====================================================
  async returnBack(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findUnique({ where: { id } });
      if (!t) throw new NotFoundException('Zimmet bulunamadı');
      if (t.toUserId !== userId)
        throw new ForbiddenException('Sadece alıcı iade edebilir');
      if (t.status !== TransactionStatus.ACCEPTED)
        throw new BadRequestException(
          'Sadece kabul edilmiş zimmet iade edilebilir',
        );

      const doc = await tx.document.findUnique({
        where: { number: t.documentNumber },
        select: { status: true },
      });

      if (doc?.status === DocumentStatus.ARCHIVED) {
        throw new BadRequestException('Arşivlenmiş evrak iade edilemez.');
      }

      await tx.transaction.update({
        where: { id },
        data: { status: TransactionStatus.RETURNED },
      });

      const backTx = await tx.transaction.create({
        data: {
          documentNumber: t.documentNumber,
          fromUserId: t.toUserId,
          toUserId: t.fromUserId,
          status: TransactionStatus.PENDING,
        },
      });

      return { message: 'İade talebi oluşturuldu', data: backTx };
    });
  }
}
