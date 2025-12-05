import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const supabaseUser = req.user;

    const user = await this.prisma.user.findUnique({
      where: { id: supabaseUser.id },
    });

    if (!user || user.role !== Role.ADMIN) {
      throw new ForbiddenException('Bu işlem için admin olmanız gerekir');
    }

    return true;
  }
}

