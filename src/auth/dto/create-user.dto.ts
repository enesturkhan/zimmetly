import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';

// Prisma'dan veya ayrı bir yerden Role Enum'unu import etmelisin
enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

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
