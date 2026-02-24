import type { Requiredness } from '../types';

/**
 * Engine 4: Classification Engine
 *
 * Recurring Detection:
 * - Same merchant_group
 * - Cadence approx 7/14/30/365 ±3 days
 * - Amount tolerance ±10% or ±$5 (whichever greater)
 * - ≥3 occurrences (≥2 for high-confidence utilities/phone)
 *
 * Requiredness Defaults:
 * - Required: Rent/mortgage, Utilities, Insurance, Minimum debt payments
 * - Semi: Groceries, Gas/transport
 * - Discretionary: Dining, Shopping, Entertainment, Travel
 */

interface TransactionRow {
  id: string;
  merchantGroup: string | null;
  categoryNorm: string | null;
  amountSigned: number;
  postedAt: Date;
  isTransfer: boolean;
  isFee: boolean;
  isInterest: boolean;
  confidenceNorm: number | null;
  isRecurring: boolean;
  recurringKey: string | null;
  requiredness: string | null;
  confidenceRequiredness: number | null;
  [key: string]: any;
}

interface RecurringGroupResult {
  merchantGroup: string;
  recurringKey: string;
  cadenceDays: number;
  avgAmount: number;
  occurrences: number;
  lastSeenAt: Date;
  transactionIds: string[];
}

// High-confidence recurring categories (need only 2 occurrences)
const HIGH_CONFIDENCE_RECURRING = ['UTILITIES', 'INSURANCE', 'HOUSING', 'SUBSCRIPTIONS'];

// Category → Requiredness defaults
const CATEGORY_REQUIREDNESS: Record<string, { requiredness: Requiredness; confidence: number }> = {
  HOUSING: { requiredness: 'REQUIRED', confidence: 0.95 },
  UTILITIES: { requiredness: 'REQUIRED', confidence: 0.90 },
  INSURANCE: { requiredness: 'REQUIRED', confidence: 0.90 },
  DEBT_PAYMENT: { requiredness: 'REQUIRED', confidence: 0.85 },
  GROCERIES: { requiredness: 'SEMI', confidence: 0.80 },
  GAS: { requiredness: 'SEMI', confidence: 0.75 },
  TRANSPORT: { requiredness: 'SEMI', confidence: 0.70 },
  HEALTHCARE: { requiredness: 'SEMI', confidence: 0.80 },
  DINING: { requiredness: 'DISCRETIONARY', confidence: 0.85 },
  SHOPPING: { requiredness: 'DISCRETIONARY', confidence: 0.85 },
  ENTERTAINMENT: { requiredness: 'DISCRETIONARY', confidence: 0.90 },
  TRAVEL: { requiredness: 'DISCRETIONARY', confidence: 0.85 },
  SUBSCRIPTIONS: { requiredness: 'DISCRETIONARY', confidence: 0.80 },
  PERSONAL_CARE: { requiredness: 'DISCRETIONARY', confidence: 0.75 },
  EDUCATION: { requiredness: 'SEMI', confidence: 0.70 },
  FEES: { requiredness: 'REQUIRED_DISCRETIONARY', confidence: 0.90 },
  INTEREST: { requiredness: 'REQUIRED_DISCRETIONARY', confidence: 0.90 },
  CHARITY: { requiredness: 'DISCRETIONARY', confidence: 0.80 },
  CHILDCARE: { requiredness: 'REQUIRED', confidence: 0.85 },
  PETS: { requiredness: 'SEMI', confidence: 0.70 },
  INCOME: { requiredness: 'REQUIRED', confidence: 0.95 },
  TRANSFER: { requiredness: 'REQUIRED', confidence: 0.50 },
  INVESTMENT: { requiredness: 'SEMI', confidence: 0.60 },
  OTHER: { requiredness: 'DISCRETIONARY', confidence: 0.40 },
};

// Allowed cadences in days
const CADENCES = [7, 14, 30, 60, 90, 365];
const CADENCE_TOLERANCE = 3; // ±3 days

export class ClassificationEngine {
  classify(transactions: TransactionRow[]): {
    transactions: TransactionRow[];
    recurringGroups: RecurringGroupResult[];
  } {
    // Step 1: Detect recurring transactions
    const recurringGroups = this.detectRecurring(transactions);

    // Step 2: Mark transactions as recurring and assign recurring keys
    const recurringTxnIds = new Map<string, string>();
    for (const group of recurringGroups) {
      for (const txnId of group.transactionIds) {
        recurringTxnIds.set(txnId, group.recurringKey);
      }
    }

    // Step 3: Assign requiredness
    for (const txn of transactions) {
      if (txn.isTransfer) {
        txn.requiredness = 'REQUIRED';
        txn.confidenceRequiredness = 0.5;
        continue;
      }

      // Check if recurring
      if (recurringTxnIds.has(txn.id)) {
        txn.isRecurring = true;
        txn.recurringKey = recurringTxnIds.get(txn.id)!;
      }

      // Assign requiredness based on category
      const category = txn.categoryNorm || 'OTHER';
      const defaults = CATEGORY_REQUIREDNESS[category] || CATEGORY_REQUIREDNESS.OTHER;
      txn.requiredness = defaults.requiredness;
      txn.confidenceRequiredness = defaults.confidence;
    }

    return { transactions, recurringGroups };
  }

  private detectRecurring(transactions: TransactionRow[]): RecurringGroupResult[] {
    // Group transactions by merchant_group (outflows only)
    const groups = new Map<string, TransactionRow[]>();

    for (const txn of transactions) {
      if (!txn.merchantGroup || txn.isTransfer || txn.amountSigned >= 0) continue;

      const key = txn.merchantGroup;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(txn);
    }

    const results: RecurringGroupResult[] = [];

    for (const [merchantGroup, txns] of groups) {
      if (txns.length < 2) continue;

      // Sort by date
      const sorted = txns.sort(
        (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime(),
      );

      // Check amount consistency
      const amounts = sorted.map((t) => Math.abs(t.amountSigned));
      const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;

      // Amount tolerance: ±10% or ±$5, whichever greater
      const tolerance = Math.max(avgAmount * 0.1, 5);
      const amountsConsistent = amounts.every((a) => Math.abs(a - avgAmount) <= tolerance);

      if (!amountsConsistent) continue;

      // Detect cadence
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const days = Math.round(
          (new Date(sorted[i].postedAt).getTime() - new Date(sorted[i - 1].postedAt).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        intervals.push(days);
      }

      if (intervals.length === 0) continue;

      // Find matching cadence
      const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;
      let matchedCadence: number | null = null;

      for (const cadence of CADENCES) {
        if (Math.abs(avgInterval - cadence) <= CADENCE_TOLERANCE) {
          matchedCadence = cadence;
          break;
        }
      }

      if (!matchedCadence) continue;

      // Check intervals are consistent with cadence
      const cadenceConsistent = intervals.every(
        (d) => Math.abs(d - matchedCadence!) <= CADENCE_TOLERANCE,
      );

      if (!cadenceConsistent) continue;

      // Minimum occurrences
      const category = sorted[0].categoryNorm || 'OTHER';
      const minOccurrences = HIGH_CONFIDENCE_RECURRING.includes(category) ? 2 : 3;

      if (sorted.length < minOccurrences) continue;

      const recurringKey = `recurring_${merchantGroup}_${matchedCadence}d`;

      results.push({
        merchantGroup,
        recurringKey,
        cadenceDays: matchedCadence,
        avgAmount: -Math.round(avgAmount * 100) / 100, // negative for outflow
        occurrences: sorted.length,
        lastSeenAt: new Date(sorted[sorted.length - 1].postedAt),
        transactionIds: sorted.map((t) => t.id),
      });
    }

    return results;
  }
}
