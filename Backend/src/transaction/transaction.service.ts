import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentStatus, TransactionStatus } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

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
        select: { number: true, currentHolderId: true, status: true },
      });

      // 4) ARŞİVDEYKEN ZİMMET ENGELİ
      if (doc.status === DocumentStatus.ARCHIVED) {
        throw new BadRequestException(
          'Bu evrak arşivlenmiş. Yeni zimmet oluşturulamaz.',
        );
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
    return this.prisma.transaction.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: { select: { id: true, fullName: true, department: true } },
        toUser: { select: { id: true, fullName: true, department: true } },
      },
    });
  }

  // =====================================================
  // DOCUMENT TIMELINE
  // =====================================================
  async listByDocument(number: string) {
    return this.prisma.transaction.findMany({
      where: { documentNumber: number },
      orderBy: { createdAt: 'asc' },
      include: {
        fromUser: { select: { id: true, fullName: true, department: true } },
        toUser: { select: { id: true, fullName: true, department: true } },
      },
    });
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
