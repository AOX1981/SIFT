import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';
import { ConnectionEngine } from '../engines/connection';

export const plaidRouter = Router();

const exchangeSchema = z.object({
  public_token: z.string(),
});

// POST /v1/plaid/link-token
plaidRouter.post('/link-token', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const connectionEngine = new ConnectionEngine();
    const linkToken = await connectionEngine.createLinkToken(userId);

    res.json({ data: linkToken });
  } catch (err) {
    next(err);
  }
});

// POST /v1/plaid/exchange
plaidRouter.post('/exchange', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const body = exchangeSchema.parse(req.body);
    const connectionEngine = new ConnectionEngine();
    const result = await connectionEngine.exchangePublicToken(userId, body.public_token);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /v1/plaid/webhook (public, signature-verified)
plaidRouter.post('/webhook', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify webhook signature in production
    const webhookType = req.body.webhook_type;
    const webhookCode = req.body.webhook_code;
    const itemId = req.body.item_id;

    if (webhookType === 'TRANSACTIONS') {
      const connection = await prisma.plaidConnection.findFirst({
        where: { itemId: itemId },
      });

      if (connection) {
        const connectionEngine = new ConnectionEngine();
        await connectionEngine.syncTransactions(connection.id);
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});
