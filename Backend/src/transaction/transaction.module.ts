import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DocumentModule } from 'src/document/document.module';
import { NotificationsModule } from 'src/ws/notifications.module';

@Module({
  imports: [PrismaModule, DocumentModule, NotificationsModule],
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}
