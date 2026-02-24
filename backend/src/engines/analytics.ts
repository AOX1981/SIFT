import type { AnalyticsSignals } from '../types';

/**
 * Engine 5: Analytics Engine (25 Signals)
 *
 * Computed over last 90 days with prior 90 comparison and 12-month if available.
 * All numeric. No AI involvement.
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
  isRecurring: boolean;
  recurringKey: string | null;
  requiredness: string | null;
  [key: string]: any;
}

export class AnalyticsEngine {
  compute(transactions: TransactionRow[]): AnalyticsSignals {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // Filter non-transfer transactions
    const nonTransfer = transactions.filter((t) => !t.isTransfer);

    // Current 90 days
    const current90 = nonTransfer.filter((t) => new Date(t.postedAt) >= ninetyDaysAgo);

    // Prior 90 days
    const prior90 = nonTransfer.filter(
      (t) => new Date(t.postedAt) >= oneEightyDaysAgo && new Date(t.postedAt) < ninetyDaysAgo,
    );

    // Outflows only (negative amounts)
    const currentOutflows = current90.filter((t) => t.amountSigned < 0);
    const priorOutflows = prior90.filter((t) => t.amountSigned < 0);

    // Inflows only (positive amounts)
    const currentInflows = current90.filter((t) => t.amountSigned > 0);

    const totalInflow = this.sum(currentInflows.map((t) => t.amountSigned));
    const totalOutflow = Math.abs(this.sum(currentOutflows.map((t) => t.amountSigned)));

    // Signal 1: Net cashflow
    const net_cashflow = totalInflow - totalOutflow;

    // Signal 2: Fixed vs variable ratio
    const fixedSpend = Math.abs(
      this.sum(currentOutflows.filter((t) => t.isRecurring).map((t) => t.amountSigned)),
    );
    const variableSpend = totalOutflow - fixedSpend;
    const fixed_vs_variable_ratio = totalOutflow > 0 ? fixedSpend / totalOutflow : 0;

    // Signal 3: Required vs discretionary ratio
    const requiredSpend = Math.abs(
      this.sum(
        currentOutflows
          .filter((t) => t.requiredness === 'REQUIRED' || t.requiredness === 'SEMI')
          .map((t) => t.amountSigned),
      ),
    );
    const discretionarySpend = Math.abs(
      this.sum(
        currentOutflows
          .filter((t) => t.requiredness === 'DISCRETIONARY' || t.requiredness === 'REQUIRED_DISCRETIONARY')
          .map((t) => t.amountSigned),
      ),
    );
    const required_vs_discretionary_ratio =
      totalOutflow > 0 ? requiredSpend / totalOutflow : 0;

    // Signal 4: Discretionary burn rate (monthly)
    const discretionary_burn_rate = discretionarySpend / 3; // 90 days → monthly

    // Signal 5: Top-merchant concentration
    const merchantSpend = new Map<string, number>();
    for (const t of currentOutflows) {
      const key = t.merchantGroup || 'unknown';
      merchantSpend.set(key, (merchantSpend.get(key) || 0) + Math.abs(t.amountSigned));
    }
    const sortedMerchants = [...merchantSpend.entries()].sort((a, b) => b[1] - a[1]);
    const topMerchantSpend = sortedMerchants.slice(0, 3).reduce((s, [, v]) => s + v, 0);
    const top_merchant_concentration = totalOutflow > 0 ? topMerchantSpend / totalOutflow : 0;

    // Signal 6: Category creep (MoM) — compare current vs prior 90-day category spend
    const category_creep_mom = this.computeCreep(currentOutflows, priorOutflows, 'categoryNorm');

    // Signal 7: Merchant creep (MoM)
    const merchant_creep_mom = this.computeCreep(currentOutflows, priorOutflows, 'merchantGroup');

    // Signal 8: Rolling baseline delta
    const priorTotalOutflow = Math.abs(this.sum(priorOutflows.map((t) => t.amountSigned)));
    const rolling_baseline_delta =
      priorTotalOutflow > 0
        ? (totalOutflow - priorTotalOutflow) / priorTotalOutflow
        : 0;

    // Signal 9: Seasonality index (coefficient of variation of monthly spend)
    const monthlySpend = this.getMonthlySpend(nonTransfer);
    const seasonality_index = this.coefficientOfVariation(Object.values(monthlySpend));

    // Signal 10: Price drift recurring
    const price_drift_recurring = this.computePriceDrift(
      transactions.filter((t) => t.isRecurring),
    );

    // Signal 11: Day-of-week map
    const day_of_week_map = this.dayOfWeekSpend(currentOutflows);

    // Signal 12: Weekend premium
    const weekdayAvg = (
      (day_of_week_map['Mon'] || 0) +
      (day_of_week_map['Tue'] || 0) +
      (day_of_week_map['Wed'] || 0) +
      (day_of_week_map['Thu'] || 0) +
      (day_of_week_map['Fri'] || 0)
    ) / 5;
    const weekendAvg = ((day_of_week_map['Sat'] || 0) + (day_of_week_map['Sun'] || 0)) / 2;
    const weekend_premium = weekdayAvg > 0 ? (weekendAvg - weekdayAvg) / weekdayAvg : 0;

    // Signal 13: Late-night premium (transactions conceptually after 10pm — approximated by description patterns)
    const late_night_premium = 0; // Would need transaction time data; default 0

    // Signal 14: Payday spike
    const payday_spike = this.computePaydaySpike(currentOutflows, currentInflows);

    // Signal 15: Impulse frequency (small discretionary purchases under $20)
    const impulseCount = currentOutflows.filter(
      (t) => Math.abs(t.amountSigned) < 20 && t.requiredness === 'DISCRETIONARY',
    ).length;
    const impulse_frequency = impulseCount / 3; // per month

    // Signal 16: Subscription count
    const subscriptions = current90.filter((t) => t.isRecurring && t.categoryNorm === 'SUBSCRIPTIONS');
    const uniqueSubs = new Set(subscriptions.map((t) => t.recurringKey || t.merchantGroup));
    const subscription_count = uniqueSubs.size;

    // Signal 17: Subscription total (monthly)
    const subscription_total = Math.abs(
      this.sum(subscriptions.map((t) => t.amountSigned)),
    ) / 3;

    // Signal 18: Fees total (90 days)
    const fees_total = Math.abs(
      this.sum(current90.filter((t) => t.isFee).map((t) => t.amountSigned)),
    );

    // Signal 19: Interest total (90 days)
    const interest_total = Math.abs(
      this.sum(current90.filter((t) => t.isInterest).map((t) => t.amountSigned)),
    );

    // Signal 20: Duplicate charges
    const duplicate_charges = this.detectDuplicates(current90);

    // Signal 21: Cash buffer estimate
    const monthlyInflow = totalInflow / 3;
    const monthlyOutflow = totalOutflow / 3;
    const cash_buffer_estimate = monthlyInflow > 0 ? (monthlyInflow - monthlyOutflow) : 0;

    // Signal 22: Volatility score (std dev of daily spend)
    const dailySpend = this.getDailySpend(currentOutflows);
    const volatility_score = this.standardDeviation(Object.values(dailySpend));

    // Signal 23: Large purchase outliers (>2 std dev from mean daily)
    const meanDaily = this.mean(Object.values(dailySpend));
    const stdDaily = volatility_score;
    const large_purchase_outliers = currentOutflows.filter(
      (t) => Math.abs(t.amountSigned) > meanDaily + 2 * stdDaily,
    ).length;

    // Signal 24: Savings rate estimate
    const savings_rate_estimate = totalInflow > 0 ? (totalInflow - totalOutflow) / totalInflow : 0;

    // Signal 25: Debt pressure proxy
    const debtPayments = Math.abs(
      this.sum(
        current90
          .filter((t) => t.categoryNorm === 'DEBT_PAYMENT' || t.isInterest)
          .map((t) => t.amountSigned),
      ),
    );
    const debt_pressure_proxy = totalInflow > 0 ? debtPayments / totalInflow : 0;

    return {
      net_cashflow: this.round(net_cashflow),
      fixed_vs_variable_ratio: this.round(fixed_vs_variable_ratio),
      required_vs_discretionary_ratio: this.round(required_vs_discretionary_ratio),
      discretionary_burn_rate: this.round(discretionary_burn_rate),
      top_merchant_concentration: this.round(top_merchant_concentration),
      category_creep_mom: this.round(category_creep_mom),
      merchant_creep_mom: this.round(merchant_creep_mom),
      rolling_baseline_delta: this.round(rolling_baseline_delta),
      seasonality_index: this.round(seasonality_index),
      price_drift_recurring: this.round(price_drift_recurring),
      day_of_week_map: Object.fromEntries(
        Object.entries(day_of_week_map).map(([k, v]) => [k, this.round(v)]),
      ),
      weekend_premium: this.round(weekend_premium),
      late_night_premium: this.round(late_night_premium),
      payday_spike: this.round(payday_spike),
      impulse_frequency: this.round(impulse_frequency),
      subscription_count,
      subscription_total: this.round(subscription_total),
      fees_total: this.round(fees_total),
      interest_total: this.round(interest_total),
      duplicate_charges,
      cash_buffer_estimate: this.round(cash_buffer_estimate),
      volatility_score: this.round(volatility_score),
      large_purchase_outliers,
      savings_rate_estimate: this.round(savings_rate_estimate),
      debt_pressure_proxy: this.round(debt_pressure_proxy),
    };
  }

  private sum(values: number[]): number {
    return values.reduce((s, v) => s + v, 0);
  }

  private mean(values: number[]): number {
    return values.length > 0 ? this.sum(values) / values.length : 0;
  }

  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map((v) => (v - avg) ** 2);
    return Math.sqrt(this.sum(squareDiffs) / (values.length - 1));
  }

  private coefficientOfVariation(values: number[]): number {
    const avg = this.mean(values);
    if (avg === 0) return 0;
    return this.standardDeviation(values) / Math.abs(avg);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private computeCreep(
    current: TransactionRow[],
    prior: TransactionRow[],
    groupField: string,
  ): number {
    const currentByGroup = this.groupSpend(current, groupField);
    const priorByGroup = this.groupSpend(prior, groupField);

    let totalDelta = 0;
    let totalPrior = 0;

    for (const [group, currentSpend] of currentByGroup) {
      const priorSpend = priorByGroup.get(group) || 0;
      totalDelta += currentSpend - priorSpend;
      totalPrior += priorSpend;
    }

    // New categories that didn't exist before
    for (const [group, priorSpend] of priorByGroup) {
      if (!currentByGroup.has(group)) {
        totalPrior += priorSpend;
      }
    }

    return totalPrior > 0 ? totalDelta / totalPrior : 0;
  }

  private groupSpend(txns: TransactionRow[], field: string): Map<string, number> {
    const groups = new Map<string, number>();
    for (const t of txns) {
      const key = (t[field] as string) || 'unknown';
      groups.set(key, (groups.get(key) || 0) + Math.abs(t.amountSigned));
    }
    return groups;
  }

  private computePriceDrift(recurringTxns: TransactionRow[]): number {
    // Group by recurring key and check if most recent is higher than earliest
    const byKey = new Map<string, TransactionRow[]>();
    for (const t of recurringTxns) {
      const key = t.recurringKey || t.merchantGroup;
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(t);
    }

    let totalDrift = 0;
    let count = 0;

    for (const [, txns] of byKey) {
      if (txns.length < 3) continue;
      const sorted = txns.sort(
        (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime(),
      );
      const earliest = Math.abs(sorted[0].amountSigned);
      const latest = Math.abs(sorted[sorted.length - 1].amountSigned);

      if (earliest > 0) {
        totalDrift += (latest - earliest) / earliest;
        count++;
      }
    }

    return count > 0 ? totalDrift / count : 0;
  }

  private dayOfWeekSpend(outflows: TransactionRow[]): Record<string, number> {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const totals: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const day of days) {
      totals[day] = 0;
      counts[day] = 0;
    }

    for (const t of outflows) {
      const day = days[new Date(t.postedAt).getDay()];
      totals[day] += Math.abs(t.amountSigned);
      counts[day]++;
    }

    // Return average daily spend per day of week
    const result: Record<string, number> = {};
    for (const day of days) {
      // Divide by number of weeks in 90 days (~13)
      result[day] = totals[day] / 13;
    }
    return result;
  }

  private computePaydaySpike(
    outflows: TransactionRow[],
    inflows: TransactionRow[],
  ): number {
    // Find likely paydays (largest inflows)
    if (inflows.length === 0) return 0;

    const sortedInflows = [...inflows].sort(
      (a, b) => b.amountSigned - a.amountSigned,
    );

    // Top inflow dates as likely paydays
    const payDayDates = new Set(
      sortedInflows.slice(0, 6).map((t) => {
        const d = new Date(t.postedAt);
        return d.getDate(); // day of month
      }),
    );

    // Compare spending in ±2 days of payday vs other days
    let paydaySpend = 0;
    let paydayDays = 0;
    let otherSpend = 0;
    let otherDays = 0;

    for (const t of outflows) {
      const dayOfMonth = new Date(t.postedAt).getDate();
      let nearPayday = false;

      for (const pd of payDayDates) {
        if (Math.abs(dayOfMonth - pd) <= 2 || Math.abs(dayOfMonth - pd + 30) <= 2) {
          nearPayday = true;
          break;
        }
      }

      if (nearPayday) {
        paydaySpend += Math.abs(t.amountSigned);
        paydayDays++;
      } else {
        otherSpend += Math.abs(t.amountSigned);
        otherDays++;
      }
    }

    const avgPayday = paydayDays > 0 ? paydaySpend / paydayDays : 0;
    const avgOther = otherDays > 0 ? otherSpend / otherDays : 0;

    return avgOther > 0 ? (avgPayday - avgOther) / avgOther : 0;
  }

  private detectDuplicates(transactions: TransactionRow[]): number {
    // Same merchant, same amount, same day = potential duplicate
    const seen = new Map<string, number>();
    let duplicates = 0;

    for (const t of transactions) {
      if (t.isTransfer) continue;
      const key = `${t.merchantGroup}_${t.amountSigned}_${new Date(t.postedAt).toISOString().split('T')[0]}`;
      const count = (seen.get(key) || 0) + 1;
      seen.set(key, count);
      if (count === 2) duplicates++; // Count each duplicate pair once
    }

    return duplicates;
  }

  private getMonthlySpend(transactions: TransactionRow[]): Record<string, number> {
    const monthly: Record<string, number> = {};
    for (const t of transactions) {
      if (t.amountSigned >= 0) continue;
      const key = new Date(t.postedAt).toISOString().slice(0, 7); // YYYY-MM
      monthly[key] = (monthly[key] || 0) + Math.abs(t.amountSigned);
    }
    return monthly;
  }

  private getDailySpend(outflows: TransactionRow[]): Record<string, number> {
    const daily: Record<string, number> = {};
    for (const t of outflows) {
      const key = new Date(t.postedAt).toISOString().split('T')[0];
      daily[key] = (daily[key] || 0) + Math.abs(t.amountSigned);
    }
    return daily;
  }
}
