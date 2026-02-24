// Canonical types matching PID specifications

export type TransactionSource = 'BANK' | 'CARD' | 'STATEMENT';

export type CategoryNorm =
  | 'HOUSING' | 'UTILITIES' | 'INSURANCE' | 'GROCERIES' | 'DINING'
  | 'TRANSPORT' | 'GAS' | 'HEALTHCARE' | 'PERSONAL_CARE' | 'SHOPPING'
  | 'ENTERTAINMENT' | 'TRAVEL' | 'EDUCATION' | 'SUBSCRIPTIONS' | 'FEES'
  | 'INTEREST' | 'DEBT_PAYMENT' | 'INCOME' | 'TRANSFER' | 'INVESTMENT'
  | 'CHARITY' | 'CHILDCARE' | 'PETS' | 'OTHER';

export type Requiredness = 'REQUIRED' | 'SEMI' | 'REQUIRED_DISCRETIONARY' | 'DISCRETIONARY';

export interface RawTransaction {
  txn_id: string;
  source: TransactionSource;
  account_id: string;
  posted_at: Date;
  amount_signed: number; // outflow negative
  currency: string;
  description_raw: string;
  merchant_raw?: string;
  balance_after?: number;
  type_raw?: string;
  category_raw?: string;
  counterparty_raw?: Record<string, unknown>;
}

export interface NormalizedTransaction extends RawTransaction {
  merchant_norm: string;
  merchant_group: string;
  category_norm: CategoryNorm;
  is_transfer: boolean;
  is_fee: boolean;
  is_interest: boolean;
  confidence_norm: number; // 0–1
  needs_review: boolean;
  is_recurring: boolean;
  recurring_key?: string;
  requiredness: Requiredness;
  confidence_requiredness: number; // 0–1
}

// Analytics Engine: 25 signals
export interface AnalyticsSignals {
  net_cashflow: number;
  fixed_vs_variable_ratio: number;
  required_vs_discretionary_ratio: number;
  discretionary_burn_rate: number;
  top_merchant_concentration: number;
  category_creep_mom: number;
  merchant_creep_mom: number;
  rolling_baseline_delta: number;
  seasonality_index: number;
  price_drift_recurring: number;
  day_of_week_map: Record<string, number>;
  weekend_premium: number;
  late_night_premium: number;
  payday_spike: number;
  impulse_frequency: number;
  subscription_count: number;
  subscription_total: number;
  fees_total: number;
  interest_total: number;
  duplicate_charges: number;
  cash_buffer_estimate: number;
  volatility_score: number;
  large_purchase_outliers: number;
  savings_rate_estimate: number;
  debt_pressure_proxy: number;
}

// Recommendation Engine output
export interface SavingsRecommendation {
  title: string;
  type: 'subscription' | 'fee' | 'interest' | 'price_drift' | 'habit_cut';
  estimated_monthly_savings: number;
  estimated_annual_savings: number;
  confidence: number;
  proof: TransactionProof[];
  steps: string[];
  score: number;
}

export interface TransactionProof {
  txn_id: string;
  description: string;
  amount: number;
  date: string;
}

// Archetype definitions
export type ArchetypeName =
  | 'PAYDAY_SPIKER'
  | 'WEEKEND_LEAKER'
  | 'SUBSCRIPTION_CREEP'
  | 'CONVENIENCE_EATER'
  | 'IMPULSE_MICRO_SPENDER'
  | 'LIFESTYLE_CREEP'
  | 'BILL_DRIFT_VICTIM'
  | 'FEE_PAYER'
  | 'INTEREST_LEAKER'
  | 'VOLATILITY_STRESSOR';

export interface Archetype {
  name: ArchetypeName;
  label: string;
  description: string;
  triggered_by: string[];
  signal_values: Record<string, number>;
}

// Narration Engine input (structured JSON for LLM)
export interface NarrationPayload {
  signals: AnalyticsSignals;
  archetypes: Archetype[];
  recommendations: SavingsRecommendation[];
  potential_annual_savings: number;
  period_start: string;
  period_end: string;
}

// Narration Engine output (validated)
export interface NarrationOutput {
  summary: string;
  archetype_narratives: { name: string; narrative: string }[];
  action_plans: { title: string; micro_plan: string }[];
  tone: string;
}

// Review 20 item
export interface ReviewItem {
  txn_id: string;
  description_raw: string;
  amount_signed: number;
  posted_at: string;
  merchant_group: string | null;
  category_norm: CategoryNorm | null;
  confidence_norm: number;
  is_transfer: boolean;
  is_fee: boolean;
  is_interest: boolean;
  review_reason: string;
}

// User correction
export interface TransactionCorrection {
  txn_id: string;
  merchant_group?: string;
  category_norm?: CategoryNorm;
  is_transfer?: boolean;
  is_fee?: boolean;
  is_interest?: boolean;
  always_apply?: boolean; // creates persistent rule
}

// API response wrappers
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
