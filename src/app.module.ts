import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DocumentModule } from './document/document.module';
import { TransactionModule } from './transaction/transaction.module';

@Module({
  imports: [PrismaModule, AuthModule, DocumentModule, TransactionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
