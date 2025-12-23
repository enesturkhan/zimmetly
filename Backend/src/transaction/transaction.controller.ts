import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { SupabaseAuthGuard } from "../auth/guards/supabase.guard";

@Controller("transactions")
@UseGuards(SupabaseAuthGuard)
export class TransactionController {
  constructor(private service: TransactionService) {}

  @Post()
  create(@Body() dto: { documentNumber: string; toUserId: string }, @Req() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Get("me")
  myList(@Req() req: any) {
    return this.service.myList(req.user.id);
  }

  @Get("document/:number")
  byDoc(@Param("number") number: string) {
    return this.service.listByDocument(number);
  }

  @Patch(":id/accept")
  accept(@Param("id") id: string, @Req() req: any) {
    return this.service.accept(id, req.user.id);
  }

  @Patch(":id/cancel")
  cancel(@Param("id") id: string, @Req() req: any) {
    return this.service.cancel(id, req.user.id);
  }

  @Patch(":id/return")
  returnBack(@Param("id") id: string, @Req() req: any) {
    return this.service.returnBack(id, req.user.id);
  }
}
