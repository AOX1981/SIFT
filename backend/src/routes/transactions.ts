import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../services/prisma';

export const transactionsRouter = Router();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(200).default(50),
  account_id: z.string().uuid().optional(),
  category: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  is_recurring: z.coerce.boolean().optional(),
  needs_review: z.coerce.boolean().optional(),
});

// GET /v1/transactions
transactionsRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const query = querySchema.parse(req.query);

    const where: Record<string, unknown> = {
      account: { userId },
    };

    if (query.account_id) where.accountId = query.account_id;
    if (query.category) where.categoryNorm = query.category;
    if (query.is_recurring !== undefined) where.isRecurring = query.is_recurring;
    if (query.needs_review !== undefined) where.needsReview = query.needs_review;

    if (query.date_from || query.date_to) {
      where.postedAt = {};
      if (query.date_from) (where.postedAt as Record<string, unknown>).gte = new Date(query.date_from);
      if (query.date_to) (where.postedAt as Record<string, unknown>).lte = new Date(query.date_to);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: where as any,
        orderBy: { postedAt: 'desc' },
        skip: (query.page - 1) * query.per_page,
        take: query.per_page,
      }),
      prisma.transaction.count({ where: where as any }),
    ]);

    res.json({
      data: transactions.map((t) => ({
        id: t.id,
        account_id: t.accountId,
        source: t.source,
        posted_at: t.postedAt,
        amount_signed: t.amountSigned,
        currency: t.currency,
        description_raw: t.descriptionRaw,
        merchant_raw: t.merchantRaw,
        merchant_norm: t.merchantNorm,
        merchant_group: t.merchantGroup,
        category_norm: t.categoryNorm,
        is_transfer: t.isTransfer,
        is_fee: t.isFee,
        is_interest: t.isInterest,
        confidence_norm: t.confidenceNorm,
        needs_review: t.needsReview,
        is_recurring: t.isRecurring,
        recurring_key: t.recurringKey,
        requiredness: t.requiredness,
      })),
      meta: {
        page: query.page,
        per_page: query.per_page,
        total,
      },
    });
  } catch (err) {
    next(err);
  }
});
