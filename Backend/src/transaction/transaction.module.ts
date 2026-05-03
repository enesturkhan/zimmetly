import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentModule } from '../document/document.module';
import { NotificationsModule } from '../ws/notifications.module';

@Module({
  imports: [PrismaModule, DocumentModule, NotificationsModule],
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}
