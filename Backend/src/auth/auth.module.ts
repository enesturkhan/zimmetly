import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [PrismaModule, UserModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService], // UserModule'de kullanılabilmesi için export ediyoruz
})
export class AuthModule {}
