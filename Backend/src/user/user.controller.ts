// src/user/user.controller.ts

import {
  Controller,
  Get,
  UseGuards,
  Patch,
  Param,
  Body,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateUserDto } from '../auth/dto/update-user.dto';

// Controller'ın temel yolu /users
@Controller('users')
// TÜM endpointler admin + token ister
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
