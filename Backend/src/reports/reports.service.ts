import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';

export type ReportAssignmentRow = {
  documentNumber: string;
  fromUser: { fullName: string; department: string | null };
  toUser: { fullName: string; department: string | null };
  assignedAt: string;
  overdueMinutes: number | null;
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getActiveSummary(): Promise<{ activeCount: number; overdueCount: number }> {
    const docsWithHolder = await this.prisma.document.findMany({
      where: { currentHolderId: { not: null } },
      select: { number: true },
    });
    const docNumbers = docsWithHolder.map((d) => d.number);

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

    const [activeCount, overdueCount] = await Promise.all([
      docNumbers.length === 0
        ? 0
        : this.prisma.transaction.count({
            where: {
              status: TransactionStatus.PENDING,
              documentNumber: { in: docNumbers },
            },
          }),
      this.prisma.transaction.count({
        where: {
          status: TransactionStatus.PENDING,
          createdAt: { lte: fifteenMinAgo },
        },
      }),
    ]);

    return { activeCount, overdueCount };
  }

  async getActiveAssignments(filter: 'ALL' | 'OVERDUE'): Promise<ReportAssignmentRow[]> {
    if (filter === 'OVERDUE') {
      return this.getOverduePending();
    }
    return this.getActiveWithHolder();
  }

  private async getActiveWithHolder(): Promise<ReportAssignmentRow[]> {
    const docs = await this.prisma.document.findMany({
      where: {
        currentHolderId: { not: null },
        status: 'ACTIVE',
      },
      orderBy: { number: 'asc' },
    });

    const results: ReportAssignmentRow[] = [];

    for (const doc of docs) {
      const lastAccepted = await this.prisma.transaction.findFirst({
        where: {
          documentNumber: doc.number,
          status: TransactionStatus.ACCEPTED,
          toUserId: doc.currentHolderId!,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          fromUser: { select: { fullName: true, department: true } },
          toUser: { select: { fullName: true, department: true } },
        },
      });

      if (!lastAccepted) continue;

      results.push({
        documentNumber: doc.number,
        fromUser: {
          fullName: lastAccepted.fromUser.fullName,
          department: lastAccepted.fromUser.department,
        },
        toUser: {
          fullName: lastAccepted.toUser.fullName,
          department: lastAccepted.toUser.department,
        },
        assignedAt: lastAccepted.createdAt.toISOString(),
        overdueMinutes: null,
      });
    }

    return results;
  }

  private async getOverduePending(): Promise<ReportAssignmentRow[]> {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

    const txList = await this.prisma.transaction.findMany({
      where: {
        status: TransactionStatus.PENDING,
        createdAt: { lte: fifteenMinAgo },
      },
      include: {
        fromUser: { select: { fullName: true, department: true } },
        toUser: { select: { fullName: true, department: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return txList.map((tx) => {
      const overdueMs = Date.now() - tx.createdAt.getTime();
      const overdueMinutes = Math.floor(overdueMs / 60000);

      return {
        documentNumber: tx.documentNumber,
        fromUser: {
          fullName: tx.fromUser.fullName,
          department: tx.fromUser.department,
        },
        toUser: {
          fullName: tx.toUser.fullName,
          department: tx.toUser.department,
        },
        assignedAt: tx.createdAt.toISOString(),
        overdueMinutes,
      };
    });
  }
}
