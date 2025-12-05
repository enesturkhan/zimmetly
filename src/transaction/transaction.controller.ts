import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { SupabaseAuthGuard } from 'src/auth/guards/supabase.guard';

@Controller('transactions')
@UseGuards(SupabaseAuthGuard) // tüm endpoint'ler login gerektirsin
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  // Zimmetle (gönder)
  @Post()
  async create(@Body() dto: CreateTransactionDto, @Req() req: any) {
    const currentUser = req.user; // SupabaseAuthGuard burada user'i koymuştu
    const fromUserId = currentUser.id;

    return this.transactionService.create(dto, fromUserId);
  }

  // Belirli evrağın tüm hareketleri (opsiyonel, ileride rapor için)
  @Get('document/:number')
  async historyByDocument(@Param('number') number: string) {
    return this.transactionService.historyByDocumentNumber(number);
  }

  // Giriş yapan kullanıcının geçmişi
  @Get('me')
  async myHistory(@Req() req: any) {
    const currentUser = req.user;
    return this.transactionService.historyByUser(currentUser.id);
  }
}
