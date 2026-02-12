import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @IsString()
  @IsNotEmpty()
  toUserId: string;

  @IsOptional()
  @IsString()
  note?: string;
}
