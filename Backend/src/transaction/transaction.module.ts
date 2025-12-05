import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DocumentModule } from 'src/document/document.module';

@Module({
  imports: [PrismaModule, DocumentModule],
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}
