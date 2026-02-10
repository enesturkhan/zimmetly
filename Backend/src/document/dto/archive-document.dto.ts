import { IsOptional, IsString, MinLength } from 'class-validator';

export class ArchiveDocumentDto {
  @IsString()
  @MinLength(1, { message: 'Arşivleme notu zorunludur' })
  note: string;

  @IsOptional()
  @IsString()
  archiveDepartment?: string;

  @IsOptional()
  @IsString()
  archiveNote?: string;
}
