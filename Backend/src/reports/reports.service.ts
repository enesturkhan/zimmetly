import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';

export type ActiveAssignmentRow = {
  documentNumber: string;
  currentHolder: { fullName: string; department: string | null };
  assignedAt: string;
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getActiveAssignments(): Promise<ActiveAssignmentRow[]> {
    const docs = await this.prisma.document.findMany({
      where: {
        currentHolderId: { not: null },
        status: 'ACTIVE',
      },
      include: {
        currentHolder: {
          select: { fullName: true, department: true },
        },
      },
      orderBy: { number: 'asc' },
    });

    const results: ActiveAssignmentRow[] = [];

    for (const doc of docs) {
      if (!doc.currentHolder) continue;

      const lastAccepted = await this.prisma.transaction.findFirst({
        where: {
          documentNumber: doc.number,
          status: TransactionStatus.ACCEPTED,
          toUserId: doc.currentHolderId!,
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      results.push({
        documentNumber: doc.number,
        currentHolder: {
          fullName: doc.currentHolder.fullName,
          department: doc.currentHolder.department,
        },
        assignedAt: lastAccepted?.createdAt?.toISOString() ?? doc.updatedAt.toISOString(),
      });
    }

    return results;
  }
}
