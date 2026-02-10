import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DocumentActionType, DocumentStatus, TransactionStatus } from '@prisma/client';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ArchiveDocumentDto } from './dto/archive-document.dto';

@Injectable()
export class DocumentService {
  constructor(private prisma: PrismaService) { }

  // İleride Transaction module burayı kullanacak
  async findOrCreateByNumber(number: string) {
    if (!number || number.trim() === '') {
      throw new BadRequestException('Evrak numarası boş olamaz');
    }

    const existing = await this.prisma.document.findUnique({
      where: { number },
    });

    if (existing) return existing;

    // Yoksa oluştur
    return this.prisma.document.create({
      data: { number },
    });
  }

  // Sadece doküman oluşturmak istersen diye, UI’de pek kullanmayabilirsin
  async create(dto: CreateDocumentDto) {
    return this.findOrCreateByNumber(dto.number);
  }

  async findAll() {
    return this.prisma.document.findMany({
      where: { status: DocumentStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByNumber(number: string) {
    const doc = await this.prisma.document.findUnique({
      where: { number },
      include: {
        currentHolder: {
          select: { id: true, fullName: true, department: true },
        },
        archivedBy: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException('Bu numarada evrak bulunamadı');
    }

    return doc;
  }

  async archive(number: string, userId: string, dto: ArchiveDocumentDto) {
    const docNumber = String(number).trim();

    if (!/^[0-9]+$/.test(docNumber)) {
      throw new BadRequestException('Evrak numarası sadece rakam olmalı');
    }

    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.findUnique({
        where: { number: docNumber },
        select: { number: true, currentHolderId: true, status: true },
      });

      if (!doc) throw new NotFoundException('Evrak bulunamadı');

      if (doc.status === DocumentStatus.ARCHIVED) {
        throw new BadRequestException('Bu evrak zaten arşivlenmiş.');
      }

      // ✅ sadece mevcut sahibi arşivleyebilir
      if (!doc.currentHolderId || doc.currentHolderId !== userId) {
        throw new ForbiddenException(
          'Bu evrak sende değil. Sadece mevcut sahibi arşivleyebilir.',
        );
      }

      // ✅ pending transaction varsa arşivlenemez
      const pending = await tx.transaction.findFirst({
        where: {
          documentNumber: docNumber,
          status: TransactionStatus.PENDING,
        },
        select: { id: true },
      });

      if (pending) {
        throw new BadRequestException(
          'Bu evrak için bekleyen zimmet var. Önce kabul/ret işlemi yapılmalı.',
        );
      }

      // ✅ Son transaction ACCEPTED ve toUserId === userId olmalı
      const lastTx = await tx.transaction.findFirst({
        where: { documentNumber: docNumber },
        orderBy: { createdAt: 'desc' },
        select: { status: true, toUserId: true },
      });

      if (
        !lastTx ||
        lastTx.status !== TransactionStatus.ACCEPTED ||
        lastTx.toUserId !== userId
      ) {
        throw new BadRequestException(
          'Bu evrak yalnızca kabul edilmiş ve sende ise arşivlenebilir.',
        );
      }

      const updated = await tx.document.update({
        where: { number: docNumber },
        data: {
          status: DocumentStatus.ARCHIVED,
          archivedAt: new Date(),
          archivedByUserId: userId,
          archiveDepartment: dto.archiveDepartment ?? null,
          archiveNote: dto.note ?? dto.archiveNote ?? null,
        },
      });

      await tx.documentNote.create({
        data: {
          documentNumber: docNumber,
          actionType: DocumentActionType.ARCHIVE,
          note: dto.note,
          createdByUserId: userId,
        },
      });

      return { message: 'Evrak arşivlendi', data: updated };
    });
  }
}

