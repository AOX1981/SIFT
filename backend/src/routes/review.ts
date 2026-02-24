import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { NormalizationEngine } from '../engines/normalization';
import type { CategoryNorm, Requiredness } from '../types';

export const reviewRouter = Router();

const correctionSchema = z.object({
  corrections: z.array(
    z.object({
      txn_id: z.string().uuid(),
      merchant_group: z.string().optional(),
      category_norm: z.string().optional(),
      is_transfer: z.boolean().optional(),
      is_fee: z.boolean().optional(),
      is_interest: z.boolean().optional(),
      always_apply: z.boolean().optional(),
    }),
  ),
});

// GET /v1/review — Review 20 screen
reviewRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    // Get transactions that need review, prioritized by impact
    const reviewItems = await prisma.transaction.findMany({
      where: {
        account: { userId },
        needsReview: true,
      },
      orderBy: [
        { confidenceNorm: 'asc' },
        { amountSigned: 'asc' }, // larger outflows first (negative)
      ],
      take: 20,
    });

    res.json({
      data: reviewItems.map((t) => {
        let review_reason = 'low_confidence';
        if ((t.confidenceNorm ?? 1) < 0.7) review_reason = 'low_confidence';
        else if (t.isTransfer) review_reason = 'suspected_transfer';
        else if (t.isRecurring && !t.recurringKey) review_reason = 'recurring_candidate';
        else if (Math.abs(t.amountSigned) > 500) review_reason = 'high_spend';

        return {
          txn_id: t.id,
          description_raw: t.descriptionRaw,
          amount_signed: t.amountSigned,
          posted_at: t.postedAt,
          merchant_group: t.merchantGroup,
          category_norm: t.categoryNorm,
          confidence_norm: t.confidenceNorm,
          is_transfer: t.isTransfer,
          is_fee: t.isFee,
          is_interest: t.isInterest,
          review_reason,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// POST /v1/review/corrections
reviewRouter.post('/corrections', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const body = correctionSchema.parse(req.body);

    let updatedCount = 0;
    let rulesCreated = 0;

    for (const correction of body.corrections) {
      // Verify transaction belongs to user
      const txn = await prisma.transaction.findFirst({
        where: {
          id: correction.txn_id,
          account: { userId },
        },
      });

      if (!txn) continue;

      // Apply correction
      const updateData: Record<string, unknown> = {
        needsReview: false,
        confidenceNorm: 1.0, // user-verified
      };

      if (correction.merchant_group !== undefined) {
        updateData.merchantGroup = correction.merchant_group;
      }
      if (correction.category_norm !== undefined) {
        updateData.categoryNorm = correction.category_norm as CategoryNorm;
      }
      if (correction.is_transfer !== undefined) {
        updateData.isTransfer = correction.is_transfer;
      }
      if (correction.is_fee !== undefined) {
        updateData.isFee = correction.is_fee;
      }
      if (correction.is_interest !== undefined) {
        updateData.isInterest = correction.is_interest;
      }

      await prisma.transaction.update({
        where: { id: correction.txn_id },
        data: updateData as any,
      });
      updatedCount++;

      // Create persistent rule if always_apply
      if (correction.always_apply && txn.descriptionRaw) {
        if (correction.merchant_group !== undefined) {
          await prisma.userRule.create({
            data: {
              userId,
              ruleType: 'MERCHANT_GROUP',
              matchField: 'description_raw',
              matchValue: txn.descriptionRaw.toLowerCase(),
              assignField: 'merchant_group',
              assignValue: correction.merchant_group,
            },
          });
          rulesCreated++;
        }

        if (correction.category_norm !== undefined) {
          await prisma.userRule.create({
            data: {
              userId,
              ruleType: 'CATEGORY',
              matchField: 'description_raw',
              matchValue: txn.descriptionRaw.toLowerCase(),
              assignField: 'category_norm',
              assignValue: correction.category_norm,
            },
          });
          rulesCreated++;
        }

        if (correction.is_transfer !== undefined) {
          await prisma.userRule.create({
            data: {
              userId,
              ruleType: 'TRANSFER',
              matchField: 'description_raw',
              matchValue: txn.descriptionRaw.toLowerCase(),
              assignField: 'is_transfer',
              assignValue: String(correction.is_transfer),
            },
          });
          rulesCreated++;
        }
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'correction',
          resource: 'transaction',
          resourceId: correction.txn_id,
          details: correction as any,
        },
      });
    }

    res.json({
      data: {
        updated_count: updatedCount,
        rules_created: rulesCreated,
      },
    });
  } catch (err) {
    next(err);
  }
});
