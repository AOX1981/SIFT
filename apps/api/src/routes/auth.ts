import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../services/prisma';
import { generateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const passwordHash = hashPassword(body.password, salt);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name ?? null,
      },
    });

    // Store password hash in a way that works with our simple schema
    // In production, add a password_hash column to the users table
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'register',
        resource: 'auth',
        details: { passwordHash: `${salt}:${passwordHash}` },
      },
    });

    const token = generateToken(user.id);

    res.status(201).json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.createdAt,
        },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Retrieve stored password hash
    const authLog = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'register', resource: 'auth' },
      orderBy: { createdAt: 'desc' },
    });

    if (!authLog?.details) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const details = authLog.details as { passwordHash: string };
    const [salt, storedHash] = details.passwordHash.split(':');
    const attemptHash = hashPassword(body.password, salt);

    if (attemptHash !== storedHash) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const token = generateToken(user.id);

    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.createdAt,
        },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});
