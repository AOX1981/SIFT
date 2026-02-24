import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRouter } from './routes/auth';
import { plaidRouter } from './routes/plaid';
import { importRouter } from './routes/import';
import { accountsRouter } from './routes/accounts';
import { transactionsRouter } from './routes/transactions';
import { reviewRouter } from './routes/review';
import { recurringRouter } from './routes/recurring';
import { analysisRouter } from './routes/analysis';
import { userRouter } from './routes/user';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 4000;

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Public routes
app.use('/v1/auth', authRouter);
app.use('/v1/plaid/webhook', plaidRouter); // webhook is public (signature verified)

// Protected routes
app.use('/v1/plaid', authMiddleware, plaidRouter);
app.use('/v1/import', authMiddleware, importRouter);
app.use('/v1/accounts', authMiddleware, accountsRouter);
app.use('/v1/transactions', authMiddleware, transactionsRouter);
app.use('/v1/review', authMiddleware, reviewRouter);
app.use('/v1/recurring', authMiddleware, recurringRouter);
app.use('/v1/analysis', authMiddleware, analysisRouter);
app.use('/v1/user', authMiddleware, userRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`SIFT API server running on port ${PORT}`);
});

export default app;
