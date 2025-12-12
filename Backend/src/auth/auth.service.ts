import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { supabaseAdmin } from '../supabase/supabase.client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';

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

    if (error) throw new BadRequestException('Email veya şifre hatalı!');
    if (!data?.user) throw new BadRequestException('Kullanıcı Bulunamadı!');

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
        // undefined ise hiç gönderme, null veya string ise gönder
        ...(department !== undefined && { department }),
        // DTO'dan gelen rolü kullan. DTO'da varsayılan olarak USER ayarlanmıştı.
        role: role || Role.USER,
      },
    });

    return {
      message: 'Kullanıcı başarıyla oluşturuldu',
      data: newUser,
    };
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
    });
  
    if (!existing) throw new BadRequestException('Kullanıcı bulunamadı');
  
    // 1) Eğer email değiştiyse kontrol edelim
    if (dto.email && dto.email !== existing.email) {
      const checkEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
  
      if (checkEmail) {
        throw new BadRequestException('Bu email zaten kullanılıyor');
      }
    }
  
    // 2) Eğer password güncellenecekse → Supabase AUTH üzerinde şifreyi güncelle
    if (dto.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: dto.password,
      });
  
      if (error) {
        throw new BadRequestException(
          'Şifre güncelleme başarısız: ' + error.message,
        );
      }
    }

    // 3) Eğer email güncellenecekse → Supabase AUTH üzerinde email'i güncelle
    if (dto.email && dto.email !== existing.email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email: dto.email,
      });
  
      if (error) {
        throw new BadRequestException(
          'Email güncelleme başarısız: ' + error.message,
        );
      }
    }
  
    // 4) Prisma kullanıcısını güncelle
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName ?? existing.fullName,
        department: dto.department ?? existing.department,
        role: dto.role ?? existing.role,
        email: dto.email ?? existing.email,
      },
    });
  
    return {
      message: 'Kullanıcı başarıyla güncellendi',
      data: updatedUser,
    };
  }
  
}
