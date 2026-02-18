import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { SupabaseAuthGuard } from "../auth/guards/supabase.guard";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { ReturnTransactionDto } from "./dto/return-transaction.dto";

@Controller("transactions")
@UseGuards(SupabaseAuthGuard)
export class TransactionController {
  constructor(private service: TransactionService) {}

  @Post()
  create(@Body() dto: CreateTransactionDto, @Req() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Get("me")
  myList(@Req() req: any) {
    return this.service.myList(req.user.id);
  }

  @Patch("mark-seen")
  markSeen(@Query("tab") tab: "INCOMING" | "IADE" | "RED", @Req() req: any) {
    return this.service.markSeen(req.user.id, tab);
  }

  @Get("document/:number")
  byDoc(@Param("number") number: string) {
    return this.service.listByDocument(number);
  }

  @Patch(":id/accept")
  accept(@Param("id") id: string, @Req() req: any) {
    return this.service.accept(id, req.user.id);
  }

  @Patch(":id/reject")
  reject(@Param("id") id: string, @Req() req: any) {
    return this.service.reject(id, req.user.id);
  }

  @Patch(":id/cancel")
  cancel(@Param("id") id: string, @Req() req: any) {
    return this.service.cancel(id, req.user.id);
  }

  @Patch(":id/return")
  returnBack(
    @Param("id") id: string,
    @Body() dto: ReturnTransactionDto,
    @Req() req: any,
  ) {
    return this.service.returnBack(id, req.user.id, dto);
  }
}
