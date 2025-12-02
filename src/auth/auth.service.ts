import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { supabaseAdmin } from '../supabase/supabase.client';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

// DTO'dan gelen değerleri kullanırken Rol Enum'unu almalıyız
// Eğer DTO'da tanımlamadıysan, buraya ekle:
enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  // LOGIN metodu
  async login(dto: LoginDto) {
    const { email, password } = dto;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new BadRequestException(error.message);
    if (!data?.user) throw new BadRequestException('Kullanıcı bulunamadı');

    // kullanıcı profili Prisma'dan çekilir
    const user = await this.prisma.user.findUnique({
      where: { id: data.user.id },
    });

    // Prisma kaydı kontrolü
    if (!user)
      throw new BadRequestException('Prisma kaydı eksik veya bulunamadı.');

    return {
      message: 'Giriş başarılı',
      session: data.session,
      user: user,
    };
  }

  // ADMIN → USER CREATE
  async createUser(dto: CreateUserDto) {
    // DTO'dan gelen role değeri (ADMIN veya USER) kullanılacak
    const { email, password, fullName, department, role } = dto;

    // 1) Email zaten var mı kontrol et
    const exists = await this.prisma.user.findUnique({
      where: { email },
    });
    if (exists)
      throw new BadRequestException('Bu email ile kullanıcı zaten var');

    // 2) Supabase Auth'ta user oluştur
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) throw new BadRequestException(error.message);
    if (!data?.user) throw new BadRequestException('Kullanıcı oluşturulamadı');

    // Supabase user id
    const authId = data.user.id;

    // 3) Prisma User tablosuna insert yap
    const newUser = await this.prisma.user.create({
      data: {
        id: authId,
        email,
        fullName,
        // Department alanı isteğe bağlı (optional) olduğu için,
        // gönderilmezse 'undefined' gelir. Prisma 'undefined' değil 'null' ister.
        department: department || null,
        // DTO'dan gelen rolü kullan. DTO'da varsayılan olarak USER ayarlanmıştı.
        role: role as Role,
      },
    });

    return {
      message: 'Kullanıcı başarıyla oluşturuldu',
      data: newUser,
    };
  }
}
