import type { AnalyticsSignals, SavingsRecommendation, TransactionProof } from '../types';

/**
 * Engine 6: Recommendation Engine (Savings Funnel)
 *
 * Output per action: title, type, estimated_monthly_savings, estimated_annual_savings,
 *   confidence, proof (transaction references), steps (1-3)
 *
 * Savings Funnel order: 1.Subscriptions 2.Fees 3.Interest 4.Bill drift 5.One discretionary lever
 *
 * Score = MonthlySavings × Confidence × (1 − AnnoyancePenalty) × QuickWinBoost
 * Safety haircut: sum(top candidates) × 0.85
 * Display "Found $X/year" only if ≥ $1000/year
 */

interface TransactionRow {
  id: string;
  descriptionRaw: string;
  merchantGroup: string | null;
  merchantNorm: string | null;
  categoryNorm: string | null;
  amountSigned: number;
  postedAt: Date;
  isTransfer: boolean;
  isFee: boolean;
  isInterest: boolean;
  isRecurring: boolean;
  recurringKey: string | null;
  requiredness: string | null;
  [key: string]: any;
}

// Annoyance penalties by type
const ANNOYANCE_PENALTY: Record<string, number> = {
  subscription: 0.1,   // Easy to cancel
  fee: 0.05,           // Usually one call
  interest: 0.15,      // May require behavior change
  price_drift: 0.2,    // Requires negotiation
  habit_cut: 0.35,     // Lifestyle change
};

export class RecommendationEngine {
  generate(
    transactions: TransactionRow[],
    signals: AnalyticsSignals,
  ): SavingsRecommendation[] {
    const recommendations: SavingsRecommendation[] = [];

    // 1. Subscription savings
    recommendations.push(...this.findSubscriptionSavings(transactions));

    // 2. Fee savings
    recommendations.push(...this.findFeeSavings(transactions));

    // 3. Interest savings
    recommendations.push(...this.findInterestSavings(transactions));

    // 4. Bill drift / price drift savings
    recommendations.push(...this.findPriceDriftSavings(transactions));

    // 5. One discretionary lever
    recommendations.push(...this.findDiscretionarySavings(transactions, signals));

    // Score and rank all recommendations
    for (const rec of recommendations) {
      rec.score = this.computeScore(rec);
    }

    // Sort by score descending, return top 5
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations.slice(0, 5);
  }

  private findSubscriptionSavings(transactions: TransactionRow[]): SavingsRecommendation[] {
    const results: SavingsRecommendation[] = [];

    // Group recurring subscription transactions
    const subs = new Map<string, TransactionRow[]>();
    for (const t of transactions) {
      if (!t.isRecurring || t.categoryNorm !== 'SUBSCRIPTIONS') continue;
      const key = t.recurringKey || t.merchantGroup || 'unknown';
      if (!subs.has(key)) subs.set(key, []);
      subs.get(key)!.push(t);
    }

    for (const [key, txns] of subs) {
      const sorted = txns.sort(
        (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
      );
      const recent = sorted[0];
      const monthlyAmount = Math.abs(recent.amountSigned);
      const merchantName = recent.merchantNorm || recent.merchantGroup || 'Subscription';

      if (monthlyAmount < 1) continue;

      const proof: TransactionProof[] = sorted.slice(0, 3).map((t) => ({
        txn_id: t.id,
        description: t.descriptionRaw,
        amount: t.amountSigned,
        date: new Date(t.postedAt).toISOString().split('T')[0],
      }));

      results.push({
        title: `Cancel or downgrade ${merchantName}`,
        type: 'subscription',
        estimated_monthly_savings: this.round(monthlyAmount),
        estimated_annual_savings: this.round(monthlyAmount * 12),
        confidence: 0.85,
        proof,
        steps: [
          `Review your ${merchantName} usage`,
          `Cancel or switch to a lower tier`,
          `Confirm cancellation and monitor for residual charges`,
        ],
        score: 0,
      });
    }

    return results;
  }

  private findFeeSavings(transactions: TransactionRow[]): SavingsRecommendation[] {
    const fees = transactions.filter((t) => t.isFee);
    if (fees.length === 0) return [];

    const totalFees90 = Math.abs(
      fees
        .filter((t) => {
          const d = new Date(t.postedAt);
          return d >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        })
        .reduce((s, t) => s + t.amountSigned, 0),
    );

    if (totalFees90 < 5) return [];

    const monthlyFees = totalFees90 / 3;

    const proof: TransactionProof[] = fees.slice(0, 5).map((t) => ({
      txn_id: t.id,
      description: t.descriptionRaw,
      amount: t.amountSigned,
      date: new Date(t.postedAt).toISOString().split('T')[0],
    }));

    // Group by fee type for specific recommendations
    const results: SavingsRecommendation[] = [];

    results.push({
      title: 'Eliminate bank and service fees',
      type: 'fee',
      estimated_monthly_savings: this.round(monthlyFees),
      estimated_annual_savings: this.round(monthlyFees * 12),
      confidence: 0.95,
      proof,
      steps: [
        'Call your bank to waive or refund recent fees',
        'Set up low-balance alerts to avoid overdraft',
        'Consider switching to a no-fee account',
      ],
      score: 0,
    });

    return results;
  }

  private findInterestSavings(transactions: TransactionRow[]): SavingsRecommendation[] {
    const interest = transactions.filter((t) => t.isInterest);
    if (interest.length === 0) return [];

    const totalInterest90 = Math.abs(
      interest
        .filter((t) => {
          const d = new Date(t.postedAt);
          return d >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        })
        .reduce((s, t) => s + t.amountSigned, 0),
    );

    if (totalInterest90 < 10) return [];

    const monthlyInterest = totalInterest90 / 3;

    const proof: TransactionProof[] = interest.slice(0, 5).map((t) => ({
      txn_id: t.id,
      description: t.descriptionRaw,
      amount: t.amountSigned,
      date: new Date(t.postedAt).toISOString().split('T')[0],
    }));

    return [
      {
        title: 'Reduce interest charges',
        type: 'interest',
        estimated_monthly_savings: this.round(monthlyInterest),
        estimated_annual_savings: this.round(monthlyInterest * 12),
        confidence: 0.95,
        proof,
        steps: [
          'Pay more than the minimum on highest-rate balances',
          'Call to negotiate a lower interest rate',
          'Consider a balance transfer to a 0% APR card',
        ],
        score: 0,
      },
    ];
  }

  private findPriceDriftSavings(transactions: TransactionRow[]): SavingsRecommendation[] {
    const results: SavingsRecommendation[] = [];

    // Group recurring transactions and check for price increases
    const recurring = new Map<string, TransactionRow[]>();
    for (const t of transactions) {
      if (!t.isRecurring) continue;
      const key = t.recurringKey || t.merchantGroup || 'unknown';
      if (!recurring.has(key)) recurring.set(key, []);
      recurring.get(key)!.push(t);
    }

    for (const [key, txns] of recurring) {
      if (txns.length < 3) continue;

      const sorted = txns.sort(
        (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime(),
      );

      const earliestAmount = Math.abs(sorted[0].amountSigned);
      const latestAmount = Math.abs(sorted[sorted.length - 1].amountSigned);

      if (earliestAmount === 0) continue;

      const drift = latestAmount - earliestAmount;
      const driftPct = drift / earliestAmount;

      // Only flag if price increased by >5%
      if (driftPct <= 0.05 || drift < 2) continue;

      const merchantName =
        sorted[0].merchantNorm || sorted[0].merchantGroup || 'Recurring bill';

      const proof: TransactionProof[] = [
        {
          txn_id: sorted[0].id,
          description: `${sorted[0].descriptionRaw} (earliest)`,
          amount: sorted[0].amountSigned,
          date: new Date(sorted[0].postedAt).toISOString().split('T')[0],
        },
        {
          txn_id: sorted[sorted.length - 1].id,
          description: `${sorted[sorted.length - 1].descriptionRaw} (latest)`,
          amount: sorted[sorted.length - 1].amountSigned,
          date: new Date(sorted[sorted.length - 1].postedAt).toISOString().split('T')[0],
        },
      ];

      results.push({
        title: `Negotiate ${merchantName} price increase`,
        type: 'price_drift',
        estimated_monthly_savings: this.round(drift),
        estimated_annual_savings: this.round(drift * 12),
        confidence: 0.70,
        proof,
        steps: [
          `${merchantName} has increased by $${this.round(drift)}/mo (${Math.round(driftPct * 100)}%)`,
          'Call retention department and ask for a rate match',
          'Compare competitor prices for leverage',
        ],
        score: 0,
      });
    }

    return results;
  }

  private findDiscretionarySavings(
    transactions: TransactionRow[],
    signals: AnalyticsSignals,
  ): SavingsRecommendation[] {
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    // Find top discretionary category
    const categorySpend = new Map<string, { total: number; txns: TransactionRow[] }>();

    for (const t of transactions) {
      if (t.amountSigned >= 0 || t.isTransfer || t.isFee || t.isInterest) continue;
      if (t.requiredness !== 'DISCRETIONARY') continue;
      if (new Date(t.postedAt).getTime() < ninetyDaysAgo) continue;

      const cat = t.categoryNorm || 'OTHER';
      if (!categorySpend.has(cat)) categorySpend.set(cat, { total: 0, txns: [] });
      const entry = categorySpend.get(cat)!;
      entry.total += Math.abs(t.amountSigned);
      entry.txns.push(t);
    }

    if (categorySpend.size === 0) return [];

    // Pick highest discretionary category
    const sorted = [...categorySpend.entries()].sort((a, b) => b[1].total - a[1].total);
    const [topCategory, { total, txns }] = sorted[0];

    const monthlySpend = total / 3;
    // Cap savings suggestion at 30% of spend
    const suggestedSavings = monthlySpend * 0.30;

    if (suggestedSavings < 10) return [];

    const proof: TransactionProof[] = txns
      .sort((a, b) => Math.abs(b.amountSigned) - Math.abs(a.amountSigned))
      .slice(0, 3)
      .map((t) => ({
        txn_id: t.id,
        description: t.descriptionRaw,
        amount: t.amountSigned,
        date: new Date(t.postedAt).toISOString().split('T')[0],
      }));

    const categoryLabel = topCategory.toLowerCase().replace(/_/g, ' ');

    return [
      {
        title: `Reduce ${categoryLabel} spending by 30%`,
        type: 'habit_cut',
        estimated_monthly_savings: this.round(suggestedSavings),
        estimated_annual_savings: this.round(suggestedSavings * 12),
        confidence: 0.55,
        proof,
        steps: [
          `You spend $${this.round(monthlySpend)}/mo on ${categoryLabel}`,
          `Set a monthly ${categoryLabel} budget of $${this.round(monthlySpend * 0.7)}`,
          'Track weekly to stay on target',
        ],
        score: 0,
      },
    ];
  }

  private computeScore(rec: SavingsRecommendation): number {
    const annoyancePenalty = ANNOYANCE_PENALTY[rec.type] || 0.2;
    const quickWinBoost = rec.estimated_monthly_savings > 50 ? 1.2 : 1.0;

    return (
      rec.estimated_monthly_savings *
      rec.confidence *
      (1 - annoyancePenalty) *
      quickWinBoost
    );
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
