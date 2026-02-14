import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationsModule } from 'src/ws/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService], // Transaction module içeriden kullanacak
})
export class DocumentModule {}
