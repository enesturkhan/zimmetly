import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentService {
  constructor(private prisma: PrismaService) {}

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
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByNumber(number: string) {
    const doc = await this.prisma.document.findUnique({
      where: { number },
    });

    if (!doc) {
      throw new NotFoundException('Bu numarada evrak bulunamadı');
    }

    return doc;
  }
}
