// src/user/user.controller.ts

import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase.guard'; // Yolun projenizin yapısına göre değiştiğini varsaydım

// Controller'ın temel yolu /users
@Controller('users')
// Bütün endpoint'ler için SupabaseAuthGuard'ı zorunlu kılar (login gerektirir)
@UseGuards(SupabaseAuthGuard)
export class UserController {
  // UserService'i enjekte et (constructor injection)
  constructor(private readonly userService: UserService) {}

  /**
   * GET /users endpoint'i
   * Tüm kullanıcıları döndürür (Adminler için kullanılabilir)
   */
  @Get()
  findAll() {
    return this.userService.findAll();
  }
}
