import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async create(
    dto: { documentNumber: string; toUserId: string },
    fromUserId: string,
  ) {
    const docNo = dto.documentNumber.trim();

    if (!/^[0-9]+$/.test(docNo)) {
      throw new BadRequestException('Evrak numarası sadece rakam olmalı');
    }

    if (dto.toUserId === fromUserId) {
      throw new BadRequestException('Kendinize zimmet gönderemezsiniz');
    }

    const toUser = await this.prisma.user.findUnique({
      where: { id: dto.toUserId },
    });
    if (!toUser || !toUser.isActive)
      throw new BadRequestException('Hedef kullanıcı aktif değil');

    // Document'i varsa oluştur, yoksa zaten var (upsert)
    await this.prisma.document.upsert({
      where: { number: docNo },
      update: {},
      create: { number: docNo },
    });

    const tx = await this.prisma.transaction.create({
      data: {
        status: TransactionStatus.PENDING,
        fromUserId,
        toUserId: dto.toUserId,
        documentNumber: docNo,
      },
      include: {
        toUser: { select: { id: true, fullName: true, department: true } },
        fromUser: { select: { id: true, fullName: true, department: true } },
      },
    });

    return { message: 'Zimmet oluşturuldu', data: tx };
  }

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

  async accept(id: string, userId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
    });
    if (!tx) throw new NotFoundException('Zimmet bulunamadı');
    if (tx.toUserId !== userId)
      throw new ForbiddenException('Bu zimmeti sadece alıcı kabul edebilir');
    if (tx.status !== TransactionStatus.PENDING)
      throw new BadRequestException('Bu zimmet beklemede değil');

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: TransactionStatus.ACCEPTED,
      },
      include: {
        fromUser: { select: { id: true, fullName: true } },
        toUser: { select: { id: true, fullName: true } },
      },
    });

    // Evrak artık alıcıda
    await this.prisma.document.update({
      where: { number: tx.documentNumber },
      data: { currentHolderId: userId },
    });

    return { message: 'Zimmet kabul edildi', data: updated };
  }

  async cancel(id: string, userId: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Zimmet bulunamadı');
    if (tx.fromUserId !== userId)
      throw new ForbiddenException('Bu zimmeti sadece gönderen geri çekebilir');
    if (tx.status !== TransactionStatus.PENDING)
      throw new BadRequestException('Kabul edilmiş zimmet geri çekilemez');

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: { status: TransactionStatus.CANCELLED },
    });

    return { message: 'Zimmet geri çekildi', data: updated };
  }

  async returnBack(id: string, userId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
    });
    if (!tx) throw new NotFoundException('Zimmet bulunamadı');
    if (tx.toUserId !== userId)
      throw new ForbiddenException('Sadece alıcı iade edebilir');
    if (tx.status !== TransactionStatus.ACCEPTED)
      throw new BadRequestException(
        'Sadece kabul edilmiş zimmet iade edilebilir',
      );

    // 1) eskisini RETURNED yap
    await this.prisma.transaction.update({
      where: { id },
      data: { status: TransactionStatus.RETURNED },
    });

    // 2) geri iade için yeni PENDING transaction aç (alıcı -> gönderen)
    const backTx = await this.prisma.transaction.create({
      data: {
        status: TransactionStatus.PENDING,
        fromUserId: tx.toUserId,
        toUserId: tx.fromUserId,
        documentNumber: tx.documentNumber,
      },
      include: {
        fromUser: { select: { id: true, fullName: true } },
        toUser: { select: { id: true, fullName: true } },
      },
    });

    return { message: 'İade talebi oluşturuldu', data: backTx };
  }
}
