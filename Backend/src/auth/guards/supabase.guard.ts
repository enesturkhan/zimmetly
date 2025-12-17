import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../supabase/supabase.client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization;

    if (!auth) {
      throw new UnauthorizedException('Token bulunamadı');
    }

    const token = auth.replace('Bearer ', '');

    // 1️⃣ Supabase token doğrulama
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Geçersiz token');
    }

    // 2️⃣ Prisma kullanıcı kontrolü
    const user = await this.prisma.user.findUnique({
      where: { id: data.user.id },
    });

     if (!user || !user.isActive) {
       throw new UnauthorizedException('Kullanıcı pasif');
     }
    

    // 3️⃣ request içine kullanıcıyı ekle
    req.user = {
      id: user.id,
      role: user.role,
    };

    return true;
  }
}
