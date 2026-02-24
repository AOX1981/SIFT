import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';
import { NormalizationEngine } from '../engines/normalization';
import { ClassificationEngine } from '../engines/classification';
import { AnalyticsEngine } from '../engines/analytics';
import { RecommendationEngine } from '../engines/recommendation';
import { ArchetypeEngine } from '../engines/archetype';
import { NarrationEngine } from '../engines/narration';

export const analysisRouter = Router();

// POST /v1/analysis — Run full analysis pipeline
analysisRouter.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const includeNarration = req.body.include_narration !== false;

    // Fetch all user transactions
    const transactions = await prisma.transaction.findMany({
      where: { account: { userId } },
      orderBy: { postedAt: 'desc' },
    });

    if (transactions.length === 0) {
      throw new AppError(400, 'NO_DATA', 'No transactions found. Import data first.');
    }

    // Fetch user rules
    const userRules = await prisma.userRule.findMany({ where: { userId } });

    // Step 1: Normalize
    const normalizationEngine = new NormalizationEngine();
    const normalizedTxns = normalizationEngine.normalize(transactions, userRules);

    // Persist normalized fields
    for (const txn of normalizedTxns) {
      await prisma.transaction.update({
        where: { id: txn.id },
        data: {
          merchantNorm: txn.merchantNorm,
          merchantGroup: txn.merchantGroup,
          categoryNorm: txn.categoryNorm as any,
          isTransfer: txn.isTransfer,
          isFee: txn.isFee,
          isInterest: txn.isInterest,
          confidenceNorm: txn.confidenceNorm,
          needsReview: txn.needsReview,
        },
      });
    }

    // Step 2: Classify (recurring + requiredness)
    const classificationEngine = new ClassificationEngine();
    const classified = classificationEngine.classify(normalizedTxns);

    // Persist classification fields and recurring groups
    for (const txn of classified.transactions) {
      await prisma.transaction.update({
        where: { id: txn.id },
        data: {
          isRecurring: txn.isRecurring,
          recurringKey: txn.recurringKey,
          requiredness: txn.requiredness as any,
          confidenceRequiredness: txn.confidenceRequiredness,
        },
      });
    }

    // Upsert recurring groups
    for (const group of classified.recurringGroups) {
      await prisma.recurringGroup.upsert({
        where: {
          userId_recurringKey: {
            userId,
            recurringKey: group.recurringKey,
          },
        },
        create: {
          userId,
          merchantGroup: group.merchantGroup,
          recurringKey: group.recurringKey,
          cadenceDays: group.cadenceDays,
          avgAmount: group.avgAmount,
          occurrences: group.occurrences,
          lastSeenAt: group.lastSeenAt,
        },
        update: {
          merchantGroup: group.merchantGroup,
          cadenceDays: group.cadenceDays,
          avgAmount: group.avgAmount,
          occurrences: group.occurrences,
          lastSeenAt: group.lastSeenAt,
        },
      });
    }

    // Step 3: Compute analytics (25 signals)
    const analyticsEngine = new AnalyticsEngine();
    const signals = analyticsEngine.compute(classified.transactions);

    // Step 4: Generate recommendations (savings funnel)
    const recommendationEngine = new RecommendationEngine();
    const recommendations = recommendationEngine.generate(classified.transactions, signals);

    // Step 5: Detect archetypes
    const archetypeEngine = new ArchetypeEngine();
    const archetypes = archetypeEngine.detect(signals);

    // Step 6: Calculate potential annual savings with safety haircut
    const topSavings = recommendations.slice(0, 5);
    const rawAnnualSavings = topSavings.reduce(
      (sum, r) => sum + r.estimated_annual_savings,
      0,
    );
    const potentialAnnualSavings = Math.round(rawAnnualSavings * 0.85 * 100) / 100;

    // Determine analysis period
    const dates = classified.transactions.map((t) => new Date(t.postedAt).getTime());
    const periodEnd = new Date(Math.max(...dates));
    const periodStart = new Date(Math.min(...dates));

    // Step 7: Narration (optional, LLM-bounded)
    let narration = null;
    if (includeNarration) {
      const narrationEngine = new NarrationEngine();
      narration = await narrationEngine.generate({
        signals,
        archetypes,
        recommendations: topSavings,
        potential_annual_savings: potentialAnnualSavings,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
      });
    }

    // Save snapshot
    await prisma.analysisSnapshot.create({
      data: {
        userId,
        signals: signals as any,
        archetypes: archetypes as any,
        recommendations: topSavings as any,
        narration: narration as any,
        periodStart,
        periodEnd,
      },
    });

    const result = {
      signals,
      archetypes,
      recommendations: topSavings,
      potential_annual_savings: potentialAnnualSavings >= 1000 ? potentialAnnualSavings : null,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      narration,
    };

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /v1/analysis/latest
analysisRouter.get('/latest', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const snapshot = await prisma.analysisSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!snapshot) {
      throw new AppError(404, 'NOT_FOUND', 'No analysis found. Run analysis first.');
    }

    res.json({
      data: {
        signals: snapshot.signals,
        archetypes: snapshot.archetypes,
        recommendations: snapshot.recommendations,
        potential_annual_savings: null, // recomputed from recommendations
        period_start: snapshot.periodStart.toISOString().split('T')[0],
        period_end: snapshot.periodEnd.toISOString().split('T')[0],
        narration: snapshot.narration,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /v1/analysis/history
analysisRouter.get('/history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 10;

    const [snapshots, total] = await Promise.all([
      prisma.analysisSnapshot.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.analysisSnapshot.count({ where: { userId } }),
    ]);

    res.json({
      data: snapshots.map((s) => ({
        signals: s.signals,
        archetypes: s.archetypes,
        recommendations: s.recommendations,
        period_start: s.periodStart.toISOString().split('T')[0],
        period_end: s.periodEnd.toISOString().split('T')[0],
        narration: s.narration,
        created_at: s.createdAt,
      })),
      meta: { page, per_page: perPage, total },
    });
  } catch (err) {
    next(err);
  }
});
