import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { supabaseAdmin } from '../supabase/supabase.client';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  // LOGIN
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

    return {
      message: 'Giriş başarılı',
      session: data.session,
      user: user,
    };
  }

  // ADMIN → USER CREATE
  async createUser(dto: CreateUserDto) {
    const { email, password, fullName, department } = dto;

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
        department,
        role: 'user',
      },
    });

    return {
      message: 'Kullanıcı başarıyla oluşturuldu',
      data: newUser,
    };
  }
}
