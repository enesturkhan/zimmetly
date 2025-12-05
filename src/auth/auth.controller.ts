import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SupabaseAuthGuard } from './guards/supabase.guard';
import { AdminGuard } from './guards/admin.guard';
import { UserService } from '../user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('create-user')
  @UseGuards(SupabaseAuthGuard, AdminGuard)
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getMe(@Req() req: any) {
    const supabaseUser = req.user; // token'dan geldi
    return await this.userService.findById(supabaseUser.id);
  }
}
