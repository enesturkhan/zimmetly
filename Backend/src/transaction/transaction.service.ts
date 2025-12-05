import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentService } from '../document/document.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private documentService: DocumentService,
  ) {}

  // Zimmet işlemi: evrak no + hedef kullanıcı, gönderen login kullanıcı
  async create(dto: CreateTransactionDto, fromUserId: string) {
    // 1) Evrakı bul ya da oluştur
    const document = await this.documentService.findOrCreateByNumber(
      dto.documentNumber,
    );

    // 2) Transaction kaydı oluştur
    const transaction = await this.prisma.transaction.create({
      data: {
        documentId: document.id,
        fromUserId,
        toUserId: dto.toUserId,
        status: 'PENDING', // Varsayılan durum
      },
      include: {
        document: true,
        fromUser: true,
        toUser: true,
      },
    });

    return {
      message: 'Zimmet başarıyla oluşturuldu',
      data: transaction,
    };
  }

  // İleride kullanmak için: belirli evrağın tüm hareketleri
  async historyByDocumentNumber(number: string) {
    const document = await this.prisma.document.findUnique({
      where: { number },
    });

    if (!document) return [];

    return this.prisma.transaction.findMany({
      where: { documentId: document.id },
      include: { fromUser: true, toUser: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Kullanıcının yaptığı/aldığı zimmetler
  async historyByUser(userId: string) {
    return this.prisma.transaction.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      include: { document: true, fromUser: true, toUser: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
