import type { AnalyticsSignals, Archetype, ArchetypeName } from '../types';

/**
 * Engine 7a: Archetype Engine
 *
 * Maximum 2 archetypes.
 * 10 deterministic archetypes triggered strictly by threshold crossings in signals.
 */

interface ArchetypeRule {
  name: ArchetypeName;
  label: string;
  description: string;
  check: (signals: AnalyticsSignals) => { triggered: boolean; triggered_by: string[]; signal_values: Record<string, number> };
}

const ARCHETYPE_RULES: ArchetypeRule[] = [
  {
    name: 'PAYDAY_SPIKER',
    label: 'Payday Spiker',
    description: 'You tend to spend significantly more right after payday. Smoothing your spending across the month could help maintain a healthier cash buffer.',
    check: (signals) => {
      const triggered = signals.payday_spike > 0.5;
      return {
        triggered,
        triggered_by: ['payday_spike > 0.5'],
        signal_values: { payday_spike: signals.payday_spike },
      };
    },
  },
  {
    name: 'WEEKEND_LEAKER',
    label: 'Weekend Leaker',
    description: 'Weekend spending significantly exceeds weekday averages. This lifestyle pattern can silently drain hundreds per month.',
    check: (signals) => {
      const triggered = signals.weekend_premium > 0.4;
      return {
        triggered,
        triggered_by: ['weekend_premium > 0.4'],
        signal_values: { weekend_premium: signals.weekend_premium },
      };
    },
  },
  {
    name: 'SUBSCRIPTION_CREEP',
    label: 'Subscription Creep',
    description: 'Your subscription count and total spend suggest creeping recurring commitments. Each one is small, but together they compound.',
    check: (signals) => {
      const triggered = signals.subscription_count >= 5 && signals.subscription_total > 100;
      return {
        triggered,
        triggered_by: ['subscription_count >= 5', 'subscription_total > $100/mo'],
        signal_values: {
          subscription_count: signals.subscription_count,
          subscription_total: signals.subscription_total,
        },
      };
    },
  },
  {
    name: 'CONVENIENCE_EATER',
    label: 'Convenience Eater',
    description: 'High frequency of food delivery and dining spend. Convenience meals are a major but often invisible cost center.',
    check: (signals) => {
      // Approximate: high discretionary burn + high top merchant concentration in food
      const triggered =
        signals.discretionary_burn_rate > 1500 &&
        signals.top_merchant_concentration > 0.3;
      return {
        triggered,
        triggered_by: [
          'discretionary_burn_rate > $1500/mo',
          'top_merchant_concentration > 0.3',
        ],
        signal_values: {
          discretionary_burn_rate: signals.discretionary_burn_rate,
          top_merchant_concentration: signals.top_merchant_concentration,
        },
      };
    },
  },
  {
    name: 'IMPULSE_MICRO_SPENDER',
    label: 'Impulse Micro-Spender',
    description: 'Frequent small discretionary purchases add up. High impulse frequency signals a pattern worth examining.',
    check: (signals) => {
      const triggered = signals.impulse_frequency > 15;
      return {
        triggered,
        triggered_by: ['impulse_frequency > 15/month'],
        signal_values: { impulse_frequency: signals.impulse_frequency },
      };
    },
  },
  {
    name: 'LIFESTYLE_CREEP',
    label: 'Lifestyle Creep',
    description: 'Overall spending is trending upward compared to prior periods. Without intervention, this pattern erodes savings capacity.',
    check: (signals) => {
      const triggered =
        signals.category_creep_mom > 0.1 && signals.rolling_baseline_delta > 0.1;
      return {
        triggered,
        triggered_by: ['category_creep_mom > 10%', 'rolling_baseline_delta > 10%'],
        signal_values: {
          category_creep_mom: signals.category_creep_mom,
          rolling_baseline_delta: signals.rolling_baseline_delta,
        },
      };
    },
  },
  {
    name: 'BILL_DRIFT_VICTIM',
    label: 'Bill Drift Victim',
    description: 'Your recurring bills have been quietly increasing over time. Proactive negotiation can reverse this trend.',
    check: (signals) => {
      const triggered = signals.price_drift_recurring > 0.05;
      return {
        triggered,
        triggered_by: ['price_drift_recurring > 5%'],
        signal_values: { price_drift_recurring: signals.price_drift_recurring },
      };
    },
  },
  {
    name: 'FEE_PAYER',
    label: 'Fee Payer',
    description: 'You are paying meaningful fees that can likely be eliminated with one or two calls.',
    check: (signals) => {
      const triggered = signals.fees_total > 50;
      return {
        triggered,
        triggered_by: ['fees_total > $50 in 90 days'],
        signal_values: { fees_total: signals.fees_total },
      };
    },
  },
  {
    name: 'INTEREST_LEAKER',
    label: 'Interest Leaker',
    description: 'Interest charges are a persistent drag on your finances. Aggressive paydown or rate reduction has high ROI.',
    check: (signals) => {
      const triggered = signals.interest_total > 100;
      return {
        triggered,
        triggered_by: ['interest_total > $100 in 90 days'],
        signal_values: { interest_total: signals.interest_total },
      };
    },
  },
  {
    name: 'VOLATILITY_STRESSOR',
    label: 'Volatility Stressor',
    description: 'Your spending has high variance, making it difficult to predict and plan. Smoothing can reduce financial stress.',
    check: (signals) => {
      const triggered = signals.volatility_score > 200 && signals.cash_buffer_estimate < 500;
      return {
        triggered,
        triggered_by: ['volatility_score > 200', 'cash_buffer_estimate < $500'],
        signal_values: {
          volatility_score: signals.volatility_score,
          cash_buffer_estimate: signals.cash_buffer_estimate,
        },
      };
    },
  },
];

export class ArchetypeEngine {
  detect(signals: AnalyticsSignals): Archetype[] {
    const triggered: Array<Archetype & { priority: number }> = [];

    for (let i = 0; i < ARCHETYPE_RULES.length; i++) {
      const rule = ARCHETYPE_RULES[i];
      const result = rule.check(signals);

      if (result.triggered) {
        triggered.push({
          name: rule.name,
          label: rule.label,
          description: rule.description,
          triggered_by: result.triggered_by,
          signal_values: result.signal_values,
          priority: i, // Lower index = higher priority in funnel order
        });
      }
    }

    // Sort by priority and return maximum 2
    triggered.sort((a, b) => a.priority - b.priority);

    return triggered.slice(0, 2).map(({ priority, ...archetype }) => archetype);
  }
}
