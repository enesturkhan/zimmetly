import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  fullName: string;

  @IsOptional() // Alanın gönderilmesi zorunlu DEĞİL
  @IsString() // Eğer gönderilirse, string olmak ZORUNDA
  department?: string; // TypeScript'te de opsiyonel (?) yaptık

  @IsOptional()
  @IsEnum(Role) // Sadece 'USER' veya 'ADMIN' değerlerini kabul etsin
  role?: Role = Role.USER; // Varsayılan değer olarak USER atıyoruz
}
