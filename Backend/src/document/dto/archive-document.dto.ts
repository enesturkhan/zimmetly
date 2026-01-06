 import { IsOptional, IsString } from 'class-validator';

export class ArchiveDocumentDto {
  @IsOptional()
  @IsString()
  archiveDepartment?: string;

  @IsOptional()
  @IsString()
  archiveNote?: string;
}
