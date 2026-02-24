import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';
import { ParsingEngine } from '../engines/parsing';

export const importRouter = Router();

// POST /v1/import/csv
importRouter.post('/csv', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const contentType = req.headers['content-type'] || '';

    // Accept raw CSV in body for simplicity (multipart in production)
    const csvData = req.body.csv_data as string;
    const accountName = req.body.account_name as string;
    const accountType = req.body.account_type as string || 'checking';

    if (!csvData || !accountName) {
      throw new AppError(400, 'INVALID_REQUEST', 'csv_data and account_name are required');
    }

    // Create import job
    const importJob = await prisma.importJob.create({
      data: {
        userId,
        source: 'CSV',
        status: 'PROCESSING',
        fileName: req.body.file_name || 'upload.csv',
        startedAt: new Date(),
      },
    });

    // Create or find account
    let account = await prisma.account.findFirst({
      where: { userId, name: accountName },
    });

    if (!account) {
      account = await prisma.account.create({
        data: {
          userId,
          name: accountName,
          type: accountType,
          source: 'csv',
        },
      });
    }

    // Parse CSV
    const parsingEngine = new ParsingEngine();

    try {
      const transactions = await parsingEngine.parseCsv(csvData);

      // Insert transactions
      let rowCount = 0;
      let errorCount = 0;
      const errors: Array<{ row: number; message: string }> = [];

      for (const txn of transactions) {
        try {
          await prisma.transaction.create({
            data: {
              accountId: account.id,
              source: 'STATEMENT',
              postedAt: txn.posted_at,
              amountSigned: txn.amount_signed,
              currency: txn.currency || 'USD',
              descriptionRaw: txn.description_raw,
              merchantRaw: txn.merchant_raw,
              importJobId: importJob.id,
            },
          });
          rowCount++;
        } catch (err) {
          errorCount++;
          errors.push({
            row: rowCount + errorCount,
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      // Update import job
      await prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          status: 'COMPLETED',
          rowCount,
          errorCount,
          errors: errors.length > 0 ? errors : undefined,
          completedAt: new Date(),
        },
      });

      res.json({
        data: {
          id: importJob.id,
          source: 'CSV',
          status: 'COMPLETED',
          file_name: importJob.fileName,
          row_count: rowCount,
          error_count: errorCount,
        },
      });
    } catch (parseErr) {
      await prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          status: 'FAILED',
          errors: [{ message: parseErr instanceof Error ? parseErr.message : 'Parse error' }],
          completedAt: new Date(),
        },
      });

      throw new AppError(400, 'PARSE_ERROR', 'Failed to parse CSV file');
    }
  } catch (err) {
    next(err);
  }
});

// GET /v1/import/:jobId
importRouter.get('/:jobId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { jobId } = req.params;

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new AppError(404, 'NOT_FOUND', 'Import job not found');
    }

    res.json({
      data: {
        id: job.id,
        source: job.source,
        status: job.status,
        file_name: job.fileName,
        row_count: job.rowCount,
        error_count: job.errorCount,
        errors: job.errors,
        started_at: job.startedAt,
        completed_at: job.completedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});
