import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('reports')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('active-assignments')
  getActiveAssignments() {
    return this.reportsService.getActiveAssignments();
  }
}
