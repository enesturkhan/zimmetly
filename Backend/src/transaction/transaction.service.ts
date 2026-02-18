import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentActionType, DocumentStatus, Role, TransactionStatus, TransactionKind } from '@prisma/client';
import { ReturnTransactionDto } from './dto/return-transaction.dto';
import { NotificationsGateway } from '../ws/notifications.gateway';

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  // =====================================================
  // CREATE (Zimmet Oluştur)
  // =====================================================
  async create(
    dto: { documentNumber: string; toUserId: string; note?: string },
    fromUserId: string,
  ) {
    const documentNumber = String(dto.documentNumber).trim();
    const toUserId = dto.toUserId;
    const note = dto.note?.trim();

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
        await tx.documentNote.create({
          data: {
            documentNumber,
            actionType: DocumentActionType.UNARCHIVE,
            note: '',
            createdByUserId: fromUserId,
          },
        });
      }

      // 5) Aynı evrak için son durum: BEKLEYEN zimmet var mı?
      const lastTx = await tx.transaction.findFirst({
        where: { documentNumber },
        orderBy: { createdAt: 'desc' },
      });

      if (lastTx?.status === TransactionStatus.PENDING) {
        throw new BadRequestException(
          'Bu evrak için zaten bekleyen bir zimmet var',
        );
      }

      // 6) Aynı kişiye ÜST ÜSTE zimmet engeli

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

      if (note && note.length > 0) {
        await tx.documentNote.create({
          data: {
            documentNumber,
            transactionId: created.id,
            actionType: DocumentActionType.SEND,
            note,
            createdByUserId: fromUserId,
          },
        });
      }

      this.notificationsGateway.notifyUser(toUserId);
      return created;
    });
  }

  // =====================================================
  // LIST (Benim Geçmişim)
  // =====================================================
  async myList(userId: string) {
    const [transactions, unreadIncomingCount, unreadReturnedCount, unreadRejectedCount] =
      await Promise.all([
        this.prisma.transaction.findMany({
          where: {
            OR: [{ fromUserId: userId }, { toUserId: userId }],
          },
          orderBy: { createdAt: 'desc' },
          include: {
            fromUser: { select: { id: true, fullName: true, department: true } },
            toUser: { select: { id: true, fullName: true, department: true } },
          },
        }),
        this.prisma.transaction.count({
          where: {
            toUserId: userId,
            status: TransactionStatus.PENDING,
            kind: { not: TransactionKind.RETURN_REQUEST },
            seenByToUser: false,
          },
        }),
        this.prisma.transaction.count({
          where: {
            toUserId: userId,
            status: TransactionStatus.PENDING,
            kind: TransactionKind.RETURN_REQUEST,
            seenByToUser: false,
          },
        }),
        this.prisma.transaction.count({
          where: {
            fromUserId: userId,
            status: TransactionStatus.REJECTED,
            seenByFromUser: false,
          },
        }),
      ]);

    const txIds = transactions.map((tx) => tx.id);
    const documentNumbers = Array.from(
      new Set(transactions.map((tx) => tx.documentNumber)),
    );
    const allNotes =
      txIds.length > 0 || documentNumbers.length > 0
        ? await this.prisma.documentNote.findMany({
            where: {
              OR: [
                {
                  transactionId: { in: txIds },
                  actionType: DocumentActionType.SEND,
                },
                {
                  documentNumber: { in: documentNumbers },
                  actionType: DocumentActionType.RETURN,
                  transactionId: { not: null },
                },
              ],
            },
            select: {
              transactionId: true,
              documentNumber: true,
              note: true,
              actionType: true,
            },
          })
        : [];

    const sendNoteMap = new Map<string, string>();
    const returnNoteMap = new Map<string, string>();
    for (const n of allNotes) {
      if (!n.transactionId) continue;
      if (n.actionType === DocumentActionType.SEND) {
        if (!sendNoteMap.has(n.transactionId)) {
          sendNoteMap.set(n.transactionId, n.note);
        }
      } else if (n.actionType === DocumentActionType.RETURN) {
        if (!returnNoteMap.has(n.transactionId)) {
          returnNoteMap.set(n.transactionId, n.note);
        }
      }
    }

    if (documentNumbers.length === 0) {
      return {
        transactions: transactions.map((tx) => ({
          ...tx,
          note: undefined as string | undefined,
          document: undefined as { status?: string } | undefined,
          isActiveForMe: false,
        })),
        unreadIncomingCount,
        unreadReturnedCount,
        unreadRejectedCount,
      };
    }

    const documents = documentNumbers.length
      ? await this.prisma.document.findMany({
        where: { number: { in: documentNumbers } },
        select: {
          number: true,
          status: true,
          currentHolderId: true,
        },
      })
      : [];

    const docMap = new Map(documents.map((doc) => [doc.number, doc]));

    const isActiveForMe = (tx: (typeof transactions)[0]) => {
      const doc = docMap.get(tx.documentNumber);
      return (
        tx.status === TransactionStatus.ACCEPTED &&
        tx.toUserId === userId &&
        doc?.currentHolderId === userId
      );
    };

    const getNoteForTx = (tx: (typeof transactions)[0]) => {
      const sendNote = sendNoteMap.get(tx.id);
      if (sendNote) return sendNote;
      const returnNote = returnNoteMap.get(tx.id);
      if (returnNote) return returnNote;
      if (tx.kind === TransactionKind.RETURN_REQUEST) {
        const returnedTx = transactions.find(
          (t) =>
            t.documentNumber === tx.documentNumber &&
            t.status === TransactionStatus.RETURNED &&
            t.fromUserId === tx.fromUserId &&
            t.toUserId === tx.toUserId,
        );
        if (returnedTx) return returnNoteMap.get(returnedTx.id);
      }
      return undefined;
    };

    const mapped = transactions.map((tx) => ({
      ...tx,
      note: getNoteForTx(tx),
      document: docMap.get(tx.documentNumber)
        ? { status: docMap.get(tx.documentNumber)?.status }
        : undefined,
      isActiveForMe: isActiveForMe(tx),
    }));

    return {
      transactions: mapped,
      unreadIncomingCount,
      unreadReturnedCount,
      unreadRejectedCount,
    };
  }

  // =====================================================
  // MARK SEEN (Okundu işaretle)
  // =====================================================
  async markSeen(userId: string, tab: 'INCOMING' | 'IADE' | 'RED') {
    if (tab === 'INCOMING') {
      await this.prisma.transaction.updateMany({
        where: {
          toUserId: userId,
          status: TransactionStatus.PENDING,
          kind: { not: TransactionKind.RETURN_REQUEST },
        },
        data: { seenByToUser: true },
      });
    } else if (tab === 'IADE') {
      await this.prisma.transaction.updateMany({
        where: {
          toUserId: userId,
          status: TransactionStatus.PENDING,
          kind: TransactionKind.RETURN_REQUEST,
        },
        data: { seenByToUser: true },
      });
    } else if (tab === 'RED') {
      await this.prisma.transaction.updateMany({
        where: {
          fromUserId: userId,
          status: TransactionStatus.REJECTED,
        },
        data: { seenByFromUser: true },
      });
    }
    return { message: 'Okundu işaretlendi' };
  }

  // =====================================================
  // DOCUMENT TIMELINE
  // =====================================================
  async listByDocument(number: string) {
    const [transactions, notes] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { documentNumber: number },
        orderBy: { createdAt: 'asc' },
        include: {
          fromUser: { select: { id: true, fullName: true, department: true } },
          toUser: { select: { id: true, fullName: true, department: true } },
        },
      }),
      this.prisma.documentNote.findMany({
        where: {
          documentNumber: number,
          actionType: {
            in: [
              DocumentActionType.SEND,
              DocumentActionType.ARCHIVE,
              DocumentActionType.UNARCHIVE,
              DocumentActionType.RETURN,
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          createdBy: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    type TimelineItem = {
      type: 'TRANSACTION';
      id: string;
      kind: string;
      createdAt: string;
      fromUser?: { id: string; fullName: string; department: string | null };
      toUser?: { id: string; fullName: string; department: string | null };
      status: string;
      note?: string;
      returnedAt?: string;
      returnNote?: string;
      rejectedAt?: string;
      rejectNote?: string;
    };

    const sendNoteMap = new Map<string, string>();
    const returnInfoMap = new Map<
      string,
      { returnedAt: string; returnNote: string }
    >();
    for (const n of notes) {
      if (n.actionType === DocumentActionType.SEND) {
        if (n.transactionId && !sendNoteMap.has(n.transactionId)) {
          sendNoteMap.set(n.transactionId, n.note);
        }
        continue;
      }
      if (n.actionType === DocumentActionType.RETURN && n.transactionId) {
        returnInfoMap.set(n.transactionId, {
          returnedAt: n.createdAt.toISOString(),
          returnNote: n.note,
        });
        continue;
      }
    }

    // Timeline = LOG: Sadece documentNumber ile tüm transaction'lar (RETURN_REQUEST dahil)
    const transactionItems: TimelineItem[] = transactions.map((tx) => {
        const returnInfo =
          tx.status === TransactionStatus.RETURNED
            ? returnInfoMap.get(tx.id)
            : undefined;
        const isRejected = tx.status === TransactionStatus.REJECTED;
        return {
          type: 'TRANSACTION',
          id: tx.id,
          kind: tx.kind,
          createdAt: tx.createdAt.toISOString(),
          fromUser: tx.fromUser ?? undefined,
          toUser: tx.toUser ?? undefined,
          status: tx.status,
          note: sendNoteMap.get(tx.id),
          returnedAt: returnInfo?.returnedAt,
          returnNote: returnInfo?.returnNote,
          rejectedAt: isRejected ? tx.updatedAt.toISOString() : undefined,
          rejectNote: undefined,
        };
      });

    const items = transactionItems.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return items;
  }

  // =====================================================
  // ACCEPT (Her aksiyon yeni kayıt - update YOK)
  // =====================================================
  async accept(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findUnique({ where: { id } });

      if (!t) throw new NotFoundException('Zimmet bulunamadı');
      if (t.status !== TransactionStatus.PENDING)
        throw new BadRequestException('Sadece bekleyen zimmet kabul edilir');
      if (t.toUserId !== userId)
        throw new ForbiddenException('Bu zimmet sana ait değil');

      // Yeni transaction oluştur (orijinali güncelleme)
      await tx.transaction.create({
        data: {
          documentNumber: t.documentNumber,
          fromUserId: t.fromUserId,
          toUserId: t.toUserId,
          status: TransactionStatus.ACCEPTED,
          kind: t.kind,
        },
      });

      await tx.document.update({
        where: { number: t.documentNumber },
        data: { currentHolderId: userId },
      });

      this.notificationsGateway.notifyUser(t.fromUserId);
      return { message: 'Zimmet kabul edildi' };
    });
  }

  // =====================================================
  // REJECT (Her aksiyon yeni kayıt - update YOK)
  // =====================================================
  async reject(id: string, userId: string) {
    const t = await this.prisma.transaction.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Zimmet bulunamadı');
    if (t.status !== TransactionStatus.PENDING)
      throw new BadRequestException('Sadece bekleyen zimmet reddedilir');
    if (t.toUserId !== userId)
      throw new ForbiddenException('Bu zimmet sana ait değil');

    const created = await this.prisma.transaction.create({
      data: {
        documentNumber: t.documentNumber,
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        status: TransactionStatus.REJECTED,
        kind: t.kind,
      },
    });
    this.notificationsGateway.notifyUser(t.fromUserId);
    return created;
  }

  // =====================================================
  // CANCEL (Gönderen geri çeker - her aksiyon yeni kayıt)
  // =====================================================
  async cancel(id: string, userId: string) {
    const t = await this.prisma.transaction.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Zimmet bulunamadı');
    if (t.fromUserId !== userId)
      throw new ForbiddenException('Sadece gönderen iptal edebilir');
    if (t.status !== TransactionStatus.PENDING)
      throw new BadRequestException('Kabul edilmiş zimmet iptal edilemez');

    return this.prisma.transaction.create({
      data: {
        documentNumber: t.documentNumber,
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        status: TransactionStatus.CANCELLED,
        kind: t.kind,
      },
    });
  }

  // =====================================================
  // RETURN (İade - her aksiyon yeni kayıt, orijinali güncelleme)
  // =====================================================
  async returnBack(id: string, userId: string, dto: ReturnTransactionDto) {
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

      // 1) İade eylemi kaydı (returner→receiver, RETURNED) - Timeline + İade Ettiklerim için
      const returnedTx = await tx.transaction.create({
        data: {
          documentNumber: t.documentNumber,
          fromUserId: t.toUserId,
          toUserId: t.fromUserId,
          status: TransactionStatus.RETURNED,
          kind: TransactionKind.NORMAL,
        },
      });

      // 2) İade talebi (Ali'nin kabul etmesi için)
      const backTx = await tx.transaction.create({
        data: {
          documentNumber: t.documentNumber,
          fromUserId: t.toUserId,
          toUserId: t.fromUserId,
          status: TransactionStatus.PENDING,
          kind: TransactionKind.RETURN_REQUEST,
        },
      });

      await tx.documentNote.create({
        data: {
          documentNumber: t.documentNumber,
          transactionId: returnedTx.id,
          actionType: DocumentActionType.RETURN,
          note: dto.note,
          createdByUserId: userId,
        },
      });

      this.notificationsGateway.notifyUser(t.fromUserId);
      return { message: 'İade talebi oluşturuldu', data: backTx };
    });
  }
}
