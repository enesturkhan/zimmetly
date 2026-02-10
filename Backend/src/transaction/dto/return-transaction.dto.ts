import { IsString, MinLength } from 'class-validator';

export class ReturnTransactionDto {
  @IsString()
  @MinLength(1, { message: 'İade notu zorunludur' })
  note: string;
}
