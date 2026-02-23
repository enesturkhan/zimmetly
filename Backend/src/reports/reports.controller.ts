import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('reports')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('active-summary')
  getActiveSummary() {
    return this.reportsService.getActiveSummary();
  }

  @Get('active-assignments')
  getActiveAssignments(@Query('filter') filter?: string) {
    const f = filter === 'OVERDUE' ? 'OVERDUE' : 'ALL';
    return this.reportsService.getActiveAssignments(f);
  }
}
