import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { supabaseAdmin } from '../supabase/supabase.client';
import { UpdateUserDto } from '../auth/dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Tekrar eden select alanları tek yerde topluyoruz
  private userSelectFields = {
    id: true,
    fullName: true,
    email: true,
    department: true,
    role: true,
    isActive: true,
    createdAt: true,
  };

  /**
   * 1) Tüm kullanıcıları listeleme (sadece aktif olanlar)
   */
  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        department: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
  

  /**
   * 2) ID ile kullanıcı getirme
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelectFields,
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    return user;
  }

  /**
   * 3) Kullanıcı güncelleme (Supabase Auth + Prisma)
   */
  async update(id: string, dto: UpdateUserDto) {
    // Önce kullanıcı var mı kontrol et
    const existing = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

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
      select: this.userSelectFields,
    });

    return {
      message: 'Kullanıcı başarıyla güncellendi',
      data: updatedUser,
    };
  }

  /**
   * 4) Kullanıcı silme (Soft Delete - Pasif yapma)
   */
  async delete(id: string) {
    // Kullanıcı var mı kontrol
    await this.findById(id);

    // Supabase Auth'tan sil
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) {
      throw new BadRequestException(
        'Supabase Auth silme hatası: ' + error.message,
      );
    }

    // Prisma'da PASİF yap (soft delete)
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      message: 'Kullanıcı pasif hale getirildi',
      userId: id,
    };
  }

  /**
   * 5) Zimmet atanabilir kullanıcıları getir (aktif olanlar, kendisi hariç)
   */
  async findAssignableUsers(currentUserId: string) {
    return this.prisma.user.findMany({
      where: {
        id: {
          not: currentUserId, // 👈 kendisi hariç
        },
        isActive: true, // 👈 sadece aktif kullanıcılar
      },
      select: {
        id: true,
        fullName: true,
        department: true,
      },
      orderBy: {
        fullName: 'asc',
      },
    });
  }

  /**
   * 6) Kullanıcı durum güncelleme (Aktif/Pasif)
   */
  async updateStatus(id: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
        role: true,
      },
    });
  }

  /**
   * 7) Kullanıcı aktif / pasif durumunu değiştir
   */
  async toggleActive(id: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        fullName: true,
        email: true,
        department: true,
        role: true,
        isActive: true,
      },
    });

    return {
      message: isActive ? 'Kullanıcı aktif edildi' : 'Kullanıcı pasif edildi',
      data: updated,
    };
  }
}
