// src/document/dto/create-document.dto.ts
import { IsString } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  number: string;
}
