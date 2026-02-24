import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../services/prisma';

export const accountsRouter = Router();

// GET /v1/accounts
accountsRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        official_name: a.officialName,
        type: a.type,
        subtype: a.subtype,
        mask: a.mask,
        current_balance: a.currentBalance,
        available_balance: a.availableBalance,
        iso_currency_code: a.isoCurrencyCode,
        source: a.source,
      })),
    });
  } catch (err) {
    next(err);
  }
});
