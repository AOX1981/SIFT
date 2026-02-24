import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';

export const userRouter = Router();

// GET /v1/user/rules
userRouter.get('/rules', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const rules = await prisma.userRule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: rules.map((r) => ({
        id: r.id,
        rule_type: r.ruleType,
        match_field: r.matchField,
        match_value: r.matchValue,
        assign_field: r.assignField,
        assign_value: r.assignValue,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /v1/user/rules?id=...
userRouter.delete('/rules', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const ruleId = req.query.id as string;

    if (!ruleId) {
      throw new AppError(400, 'INVALID_REQUEST', 'Rule ID is required');
    }

    const rule = await prisma.userRule.findFirst({
      where: { id: ruleId, userId },
    });

    if (!rule) {
      throw new AppError(404, 'NOT_FOUND', 'Rule not found');
    }

    await prisma.userRule.delete({ where: { id: ruleId } });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// DELETE /v1/user/delete — Hard delete user and all data
userRouter.delete('/delete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    // Cascade delete handles most relations
    await prisma.user.delete({ where: { id: userId } });

    await prisma.auditLog.create({
      data: {
        action: 'user_deleted',
        resource: 'user',
        resourceId: userId,
      },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
