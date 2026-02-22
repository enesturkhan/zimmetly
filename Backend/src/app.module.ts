import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DocumentModule } from './document/document.module';
import { TransactionModule } from './transaction/transaction.module';
import { UserModule } from './user/user.module';
import { NotificationsModule } from './ws/notifications.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // .env dosyasını yükler
    PrismaModule,
    AuthModule,
    DocumentModule,
    TransactionModule,
    UserModule,
    NotificationsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
