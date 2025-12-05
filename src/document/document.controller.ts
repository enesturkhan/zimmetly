import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SupabaseAuthGuard } from 'src/auth/guards/supabase.guard';

@Controller('documents')
@UseGuards(SupabaseAuthGuard) // tüm document endpoint'leri login gerektirsin
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // İstersen manuel test için kullanılır (Postman vs)
  @Post()
  create(@Body() dto: CreateDocumentDto) {
    return this.documentService.create(dto);
  }

  @Get()
  findAll() {
    return this.documentService.findAll();
  }

  @Get(':number')
  findByNumber(@Param('number') number: string) {
    return this.documentService.findByNumber(number);
  }
}
