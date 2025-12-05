// src/transaction/dto/create-transaction.dto.ts
import { IsString } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  documentNumber: string; // Kullanıcının yazdığı evrak numarası

  @IsString()
  toUserId: string; // Zimmetlenecek kişi
}
