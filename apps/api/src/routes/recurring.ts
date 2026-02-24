import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';

export const recurringRouter = Router();

const confirmSchema = z.object({
  confirmed: z.boolean(),
  requiredness: z.enum(['REQUIRED', 'SEMI', 'REQUIRED_DISCRETIONARY', 'DISCRETIONARY']).optional(),
});

// GET /v1/recurring
recurringRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const groups = await prisma.recurringGroup.findMany({
      where: { userId },
      orderBy: { avgAmount: 'asc' }, // largest spend first (negative)
    });

    res.json({
      data: groups.map((g) => ({
        id: g.id,
        merchant_group: g.merchantGroup,
        recurring_key: g.recurringKey,
        cadence_days: g.cadenceDays,
        avg_amount: g.avgAmount,
        occurrences: g.occurrences,
        last_seen_at: g.lastSeenAt,
        is_confirmed: g.isConfirmed,
        requiredness: g.requiredness,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /v1/recurring/:id/confirm
recurringRouter.post('/:id/confirm', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const body = confirmSchema.parse(req.body);

    const group = await prisma.recurringGroup.findFirst({
      where: { id, userId },
    });

    if (!group) {
      throw new AppError(404, 'NOT_FOUND', 'Recurring group not found');
    }

    const updated = await prisma.recurringGroup.update({
      where: { id },
      data: {
        isConfirmed: body.confirmed,
        requiredness: body.requiredness ?? group.requiredness,
      },
    });

    res.json({
      data: {
        id: updated.id,
        merchant_group: updated.merchantGroup,
        recurring_key: updated.recurringKey,
        cadence_days: updated.cadenceDays,
        avg_amount: updated.avgAmount,
        occurrences: updated.occurrences,
        last_seen_at: updated.lastSeenAt,
        is_confirmed: updated.isConfirmed,
        requiredness: updated.requiredness,
      },
    });
  } catch (err) {
    next(err);
  }
});
