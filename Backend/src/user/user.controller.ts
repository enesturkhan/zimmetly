import {
  Controller,
  Get,
  UseGuards,
  Patch,
  Param,
  Body,
  Delete,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateUserDto } from '../auth/dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-status.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 🔹 ZİMMET İÇİN KULLANICI LİSTESİ
   * 🔹 Tüm login olmuş kullanıcılar erişebilir
   * 🔹 KENDİSİ HARİÇ + SADECE AKTİF
   *
   * ⚠️ EN ÜSTE YAZILMAK ZORUNDA
   */
  @Get('assignable')
  @UseGuards(SupabaseAuthGuard)
  getAssignableUsers(@Req() req: { user: { id: string } }) {
    return this.userService.findAssignableUsers(req.user.id);
  }

  /**
   * 🔹 TÜM KULLANICILARI LİSTELE (ADMIN)
   */
    @Get()
  @UseGuards(SupabaseAuthGuard, AdminGuard)
    findAll() {
      return this.userService.findAll();
    }
  
  /**
   * 🔹 KULLANICI GÜNCELLE (ADMIN)
   */
    @Patch(':id')
  @UseGuards(SupabaseAuthGuard, AdminGuard)
    update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
      return this.userService.update(id, dto);
    }
  
  /**
   * 🔹 KULLANICI SİL (ADMIN)
   */
    @Delete(':id')
  @UseGuards(SupabaseAuthGuard, AdminGuard)
    delete(@Param('id') id: string) {
      return this.userService.delete(id);
  }

  /**
   * 🔹 KULLANICI DURUM GÜNCELLE (ADMIN) - Aktif/Pasif yap
   */
  @Patch(':id/status')
  @UseGuards(SupabaseAuthGuard, AdminGuard)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.userService.updateStatus(id, dto.isActive);
  }

  /**
   * 🔹 KULLANICI AKTİF / PASİF TOGGLE (ADMIN)
   */
  @Patch(':id/active')
  @UseGuards(SupabaseAuthGuard, AdminGuard)
  toggleActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.userService.toggleActive(id, body.isActive);
  }
}
