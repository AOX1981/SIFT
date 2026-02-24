import type { CategoryNorm } from '../types';

/**
 * Engine 3: Normalization Engine (KEYSTONE)
 *
 * Adds: merchant_norm, merchant_group, category_norm,
 *       is_transfer, is_fee, is_interest, confidence_norm, needs_review
 *
 * Deterministic rules:
 * 1. Merchant dictionary (exact + contains match)
 * 2. High-threshold fuzzy matching only
 * 3. Category mapping: merchant_group → category_norm
 * 4. Transfer detection (keyword + same-day opposite-sign)
 * 5. Fee detection (keyword-based)
 * 6. Interest detection (keyword-based)
 */

interface TransactionRow {
  id: string;
  descriptionRaw: string;
  merchantRaw: string | null;
  amountSigned: number;
  postedAt: Date;
  categoryRaw: string | null;
  counterpartyRaw: any;
  // Normalized outputs
  merchantNorm: string | null;
  merchantGroup: string | null;
  categoryNorm: string | null;
  isTransfer: boolean;
  isFee: boolean;
  isInterest: boolean;
  confidenceNorm: number | null;
  needsReview: boolean;
  [key: string]: any;
}

interface UserRuleRow {
  ruleType: string;
  matchField: string;
  matchValue: string;
  assignField: string;
  assignValue: string;
}

// Merchant dictionary: pattern → { merchant_norm, merchant_group }
const MERCHANT_DICTIONARY: Array<{
  patterns: string[];
  containsPatterns?: string[];
  merchant_norm: string;
  merchant_group: string;
}> = [
  // Streaming
  { patterns: ['netflix'], containsPatterns: ['netflix'], merchant_norm: 'Netflix', merchant_group: 'netflix' },
  { patterns: ['hulu'], containsPatterns: ['hulu'], merchant_norm: 'Hulu', merchant_group: 'hulu' },
  { patterns: ['spotify'], containsPatterns: ['spotify'], merchant_norm: 'Spotify', merchant_group: 'spotify' },
  { patterns: ['apple music', 'itunes'], containsPatterns: ['apple music', 'itunes'], merchant_norm: 'Apple Music', merchant_group: 'apple_music' },
  { patterns: ['disney+', 'disneyplus', 'disney plus'], containsPatterns: ['disney'], merchant_norm: 'Disney+', merchant_group: 'disney_plus' },
  { patterns: ['hbo', 'max.com'], containsPatterns: ['hbo'], merchant_norm: 'HBO Max', merchant_group: 'hbo_max' },
  { patterns: ['youtube premium', 'youtube music'], containsPatterns: ['youtube prem', 'youtube music'], merchant_norm: 'YouTube Premium', merchant_group: 'youtube_premium' },
  { patterns: ['amazon prime', 'amzn prime'], containsPatterns: ['prime video', 'amzn prime'], merchant_norm: 'Amazon Prime', merchant_group: 'amazon_prime' },
  { patterns: ['paramount+', 'paramount plus'], containsPatterns: ['paramount'], merchant_norm: 'Paramount+', merchant_group: 'paramount_plus' },
  { patterns: ['peacock'], containsPatterns: ['peacock'], merchant_norm: 'Peacock', merchant_group: 'peacock' },

  // Food delivery
  { patterns: ['doordash'], containsPatterns: ['doordash', 'dd *'], merchant_norm: 'DoorDash', merchant_group: 'doordash' },
  { patterns: ['uber eats', 'ubereats'], containsPatterns: ['uber eat', 'ubereats'], merchant_norm: 'Uber Eats', merchant_group: 'uber_eats' },
  { patterns: ['grubhub'], containsPatterns: ['grubhub'], merchant_norm: 'Grubhub', merchant_group: 'grubhub' },
  { patterns: ['instacart'], containsPatterns: ['instacart'], merchant_norm: 'Instacart', merchant_group: 'instacart' },

  // Rideshare
  { patterns: ['uber trip', 'uber *trip'], containsPatterns: ['uber trip', 'uber *trip'], merchant_norm: 'Uber', merchant_group: 'uber' },
  { patterns: ['lyft'], containsPatterns: ['lyft'], merchant_norm: 'Lyft', merchant_group: 'lyft' },

  // Groceries
  { patterns: ['whole foods', 'wholefoods'], containsPatterns: ['whole foods', 'wholefoods', 'wfm'], merchant_norm: 'Whole Foods', merchant_group: 'whole_foods' },
  { patterns: ['trader joes', "trader joe's"], containsPatterns: ['trader joe'], merchant_norm: "Trader Joe's", merchant_group: 'trader_joes' },
  { patterns: ['walmart', 'wal-mart'], containsPatterns: ['walmart', 'wal-mart', 'wal mart'], merchant_norm: 'Walmart', merchant_group: 'walmart' },
  { patterns: ['costco'], containsPatterns: ['costco'], merchant_norm: 'Costco', merchant_group: 'costco' },
  { patterns: ['target'], containsPatterns: ['target'], merchant_norm: 'Target', merchant_group: 'target' },
  { patterns: ['kroger'], containsPatterns: ['kroger'], merchant_norm: 'Kroger', merchant_group: 'kroger' },
  { patterns: ['safeway'], containsPatterns: ['safeway'], merchant_norm: 'Safeway', merchant_group: 'safeway' },
  { patterns: ['publix'], containsPatterns: ['publix'], merchant_norm: 'Publix', merchant_group: 'publix' },
  { patterns: ['aldi'], containsPatterns: ['aldi'], merchant_norm: 'Aldi', merchant_group: 'aldi' },

  // Coffee
  { patterns: ['starbucks'], containsPatterns: ['starbucks', 'sbux'], merchant_norm: 'Starbucks', merchant_group: 'starbucks' },
  { patterns: ['dunkin'], containsPatterns: ['dunkin'], merchant_norm: "Dunkin'", merchant_group: 'dunkin' },

  // Fast food / Dining
  { patterns: ['mcdonalds', "mcdonald's"], containsPatterns: ['mcdonald'], merchant_norm: "McDonald's", merchant_group: 'mcdonalds' },
  { patterns: ['chipotle'], containsPatterns: ['chipotle'], merchant_norm: 'Chipotle', merchant_group: 'chipotle' },
  { patterns: ['chick-fil-a', 'chick fil a'], containsPatterns: ['chick-fil', 'chick fil'], merchant_norm: 'Chick-fil-A', merchant_group: 'chick_fil_a' },
  { patterns: ['subway'], containsPatterns: ['subway'], merchant_norm: 'Subway', merchant_group: 'subway' },

  // Gas
  { patterns: ['shell oil', 'shell service'], containsPatterns: ['shell'], merchant_norm: 'Shell', merchant_group: 'shell_gas' },
  { patterns: ['chevron'], containsPatterns: ['chevron'], merchant_norm: 'Chevron', merchant_group: 'chevron_gas' },
  { patterns: ['exxon', 'exxonmobil'], containsPatterns: ['exxon'], merchant_norm: 'ExxonMobil', merchant_group: 'exxon_gas' },
  { patterns: ['bp'], containsPatterns: ['bp gas', 'bp #'], merchant_norm: 'BP', merchant_group: 'bp_gas' },

  // Shopping
  { patterns: ['amazon.com', 'amzn mktp', 'amazon mktp'], containsPatterns: ['amazon', 'amzn'], merchant_norm: 'Amazon', merchant_group: 'amazon' },
  { patterns: ['apple.com', 'apple store'], containsPatterns: ['apple.com', 'apple store'], merchant_norm: 'Apple', merchant_group: 'apple' },

  // Utilities
  { patterns: ['comcast', 'xfinity'], containsPatterns: ['comcast', 'xfinity'], merchant_norm: 'Comcast/Xfinity', merchant_group: 'comcast' },
  { patterns: ['at&t', 'att'], containsPatterns: ['at&t', 'att '], merchant_norm: 'AT&T', merchant_group: 'att' },
  { patterns: ['verizon'], containsPatterns: ['verizon'], merchant_norm: 'Verizon', merchant_group: 'verizon' },
  { patterns: ['t-mobile', 'tmobile'], containsPatterns: ['t-mobile', 'tmobile'], merchant_norm: 'T-Mobile', merchant_group: 'tmobile' },

  // Insurance
  { patterns: ['geico'], containsPatterns: ['geico'], merchant_norm: 'GEICO', merchant_group: 'geico' },
  { patterns: ['state farm'], containsPatterns: ['state farm'], merchant_norm: 'State Farm', merchant_group: 'state_farm' },
  { patterns: ['progressive'], containsPatterns: ['progressive ins'], merchant_norm: 'Progressive', merchant_group: 'progressive' },

  // Gym / fitness
  { patterns: ['planet fitness'], containsPatterns: ['planet fit'], merchant_norm: 'Planet Fitness', merchant_group: 'planet_fitness' },
  { patterns: ['equinox'], containsPatterns: ['equinox'], merchant_norm: 'Equinox', merchant_group: 'equinox' },
  { patterns: ['peloton'], containsPatterns: ['peloton'], merchant_norm: 'Peloton', merchant_group: 'peloton' },

  // Software / SaaS
  { patterns: ['google storage', 'google one'], containsPatterns: ['google *storage', 'google one', 'google *one'], merchant_norm: 'Google One', merchant_group: 'google_one' },
  { patterns: ['icloud', 'apple icloud'], containsPatterns: ['icloud'], merchant_norm: 'iCloud', merchant_group: 'icloud' },
  { patterns: ['dropbox'], containsPatterns: ['dropbox'], merchant_norm: 'Dropbox', merchant_group: 'dropbox' },
  { patterns: ['adobe'], containsPatterns: ['adobe'], merchant_norm: 'Adobe', merchant_group: 'adobe' },
  { patterns: ['microsoft', 'msft'], containsPatterns: ['microsoft', 'msft'], merchant_norm: 'Microsoft', merchant_group: 'microsoft' },
];

// Merchant group → category mapping
const GROUP_TO_CATEGORY: Record<string, CategoryNorm> = {
  // Streaming / Subscriptions
  netflix: 'SUBSCRIPTIONS', hulu: 'SUBSCRIPTIONS', spotify: 'SUBSCRIPTIONS',
  apple_music: 'SUBSCRIPTIONS', disney_plus: 'SUBSCRIPTIONS', hbo_max: 'SUBSCRIPTIONS',
  youtube_premium: 'SUBSCRIPTIONS', amazon_prime: 'SUBSCRIPTIONS',
  paramount_plus: 'SUBSCRIPTIONS', peacock: 'SUBSCRIPTIONS',
  peloton: 'SUBSCRIPTIONS', google_one: 'SUBSCRIPTIONS', icloud: 'SUBSCRIPTIONS',
  dropbox: 'SUBSCRIPTIONS', adobe: 'SUBSCRIPTIONS', microsoft: 'SUBSCRIPTIONS',

  // Food delivery
  doordash: 'DINING', uber_eats: 'DINING', grubhub: 'DINING', instacart: 'GROCERIES',

  // Rideshare
  uber: 'TRANSPORT', lyft: 'TRANSPORT',

  // Groceries
  whole_foods: 'GROCERIES', trader_joes: 'GROCERIES', walmart: 'GROCERIES',
  costco: 'GROCERIES', target: 'SHOPPING', kroger: 'GROCERIES',
  safeway: 'GROCERIES', publix: 'GROCERIES', aldi: 'GROCERIES',

  // Coffee / Dining
  starbucks: 'DINING', dunkin: 'DINING', mcdonalds: 'DINING',
  chipotle: 'DINING', chick_fil_a: 'DINING', subway: 'DINING',

  // Gas
  shell_gas: 'GAS', chevron_gas: 'GAS', exxon_gas: 'GAS', bp_gas: 'GAS',

  // Shopping
  amazon: 'SHOPPING', apple: 'SHOPPING',

  // Utilities
  comcast: 'UTILITIES', att: 'UTILITIES', verizon: 'UTILITIES', tmobile: 'UTILITIES',

  // Insurance
  geico: 'INSURANCE', state_farm: 'INSURANCE', progressive: 'INSURANCE',

  // Fitness
  planet_fitness: 'SUBSCRIPTIONS', equinox: 'SUBSCRIPTIONS',
};

// Transfer keywords
const TRANSFER_KEYWORDS = [
  'transfer', 'xfer', 'ach transfer', 'wire transfer',
  'zelle', 'venmo', 'cashapp', 'cash app',
  'paypal transfer', 'bank transfer', 'internal transfer',
  'savings transfer', 'checking transfer',
];

// Fee keywords
const FEE_KEYWORDS = [
  'fee', 'overdraft', 'nsf', 'atm fee', 'service charge',
  'monthly service', 'maintenance fee', 'wire fee',
  'foreign transaction fee', 'late fee', 'returned item',
  'insufficient funds',
];

// Interest keywords
const INTEREST_KEYWORDS = [
  'interest charge', 'interest payment', 'finance charge',
  'interest charged', 'purchase interest', 'cash advance interest',
  'penalty interest', 'interest on',
];

// Plaid category → our category mapping
const PLAID_CATEGORY_MAP: Record<string, CategoryNorm> = {
  INCOME: 'INCOME',
  TRANSFER_IN: 'TRANSFER',
  TRANSFER_OUT: 'TRANSFER',
  LOAN_PAYMENTS: 'DEBT_PAYMENT',
  BANK_FEES: 'FEES',
  ENTERTAINMENT: 'ENTERTAINMENT',
  FOOD_AND_DRINK: 'DINING',
  GENERAL_MERCHANDISE: 'SHOPPING',
  GENERAL_SERVICES: 'OTHER',
  GOVERNMENT_AND_NON_PROFIT: 'OTHER',
  HOME_IMPROVEMENT: 'HOUSING',
  MEDICAL: 'HEALTHCARE',
  PERSONAL_CARE: 'PERSONAL_CARE',
  RENT_AND_UTILITIES: 'UTILITIES',
  TRANSPORTATION: 'TRANSPORT',
  TRAVEL: 'TRAVEL',
};

export class NormalizationEngine {
  normalize(transactions: TransactionRow[], userRules: UserRuleRow[]): TransactionRow[] {
    // Step 1: Apply user rules first (highest priority)
    const ruleMap = this.buildRuleMap(userRules);

    for (const txn of transactions) {
      const descLower = txn.descriptionRaw.toLowerCase();

      // Apply user rules
      const appliedRule = this.applyUserRules(txn, ruleMap);

      // Merchant matching (if not overridden by rules)
      if (!appliedRule.merchantGroup) {
        const match = this.matchMerchant(descLower, txn.merchantRaw);
        if (match) {
          txn.merchantNorm = match.merchant_norm;
          txn.merchantGroup = match.merchant_group;
          txn.confidenceNorm = 0.95;
        } else {
          // Fallback: use merchant_raw or clean description
          txn.merchantNorm = txn.merchantRaw || this.cleanDescription(txn.descriptionRaw);
          txn.merchantGroup = this.slugify(txn.merchantNorm);
          txn.confidenceNorm = txn.merchantRaw ? 0.6 : 0.4;
        }
      }

      // Category mapping (if not overridden by rules)
      if (!appliedRule.categoryNorm) {
        if (txn.merchantGroup && GROUP_TO_CATEGORY[txn.merchantGroup]) {
          txn.categoryNorm = GROUP_TO_CATEGORY[txn.merchantGroup];
        } else if (txn.categoryRaw && PLAID_CATEGORY_MAP[txn.categoryRaw]) {
          txn.categoryNorm = PLAID_CATEGORY_MAP[txn.categoryRaw];
        } else {
          txn.categoryNorm = this.inferCategory(descLower, txn.amountSigned);
        }
      }

      // Transfer detection (if not overridden)
      if (appliedRule.isTransfer === undefined) {
        txn.isTransfer = this.detectTransfer(descLower);
      }

      // Fee detection (if not overridden)
      if (appliedRule.isFee === undefined) {
        txn.isFee = this.detectFee(descLower);
        if (txn.isFee) txn.categoryNorm = 'FEES';
      }

      // Interest detection (if not overridden)
      if (appliedRule.isInterest === undefined) {
        txn.isInterest = this.detectInterest(descLower);
        if (txn.isInterest) txn.categoryNorm = 'INTEREST';
      }

      // Income detection
      if (txn.amountSigned > 0 && !txn.isTransfer) {
        const incomeKeywords = ['payroll', 'direct dep', 'salary', 'wages', 'paycheck', 'employer'];
        if (incomeKeywords.some((k) => descLower.includes(k))) {
          txn.categoryNorm = 'INCOME';
        }
      }

      // Determine needs_review
      txn.needsReview = this.shouldReview(txn);
    }

    // Same-day opposite-sign transfer detection
    this.detectSameDayTransfers(transactions);

    return transactions;
  }

  private buildRuleMap(rules: UserRuleRow[]): Map<string, UserRuleRow[]> {
    const map = new Map<string, UserRuleRow[]>();
    for (const rule of rules) {
      const key = rule.matchValue.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(rule);
    }
    return map;
  }

  private applyUserRules(
    txn: TransactionRow,
    ruleMap: Map<string, UserRuleRow[]>,
  ): { merchantGroup?: boolean; categoryNorm?: boolean; isTransfer?: boolean; isFee?: boolean; isInterest?: boolean } {
    const applied: Record<string, boolean> = {};
    const descLower = txn.descriptionRaw.toLowerCase();

    for (const [matchValue, rules] of ruleMap) {
      if (!descLower.includes(matchValue)) continue;

      for (const rule of rules) {
        switch (rule.assignField) {
          case 'merchant_group':
            txn.merchantGroup = rule.assignValue;
            txn.merchantNorm = rule.assignValue;
            txn.confidenceNorm = 1.0;
            applied.merchantGroup = true;

            if (GROUP_TO_CATEGORY[rule.assignValue]) {
              txn.categoryNorm = GROUP_TO_CATEGORY[rule.assignValue];
              applied.categoryNorm = true;
            }
            break;
          case 'category_norm':
            txn.categoryNorm = rule.assignValue;
            applied.categoryNorm = true;
            break;
          case 'is_transfer':
            txn.isTransfer = rule.assignValue === 'true';
            applied.isTransfer = true;
            break;
          case 'is_fee':
            txn.isFee = rule.assignValue === 'true';
            applied.isFee = true;
            break;
          case 'is_interest':
            txn.isInterest = rule.assignValue === 'true';
            applied.isInterest = true;
            break;
        }
      }
    }

    return applied;
  }

  private matchMerchant(
    descLower: string,
    merchantRaw: string | null,
  ): { merchant_norm: string; merchant_group: string } | null {
    const searchStr = merchantRaw ? `${descLower} ${merchantRaw.toLowerCase()}` : descLower;

    // Exact match first
    for (const entry of MERCHANT_DICTIONARY) {
      if (entry.patterns.some((p) => searchStr === p || descLower === p)) {
        return { merchant_norm: entry.merchant_norm, merchant_group: entry.merchant_group };
      }
    }

    // Contains match
    for (const entry of MERCHANT_DICTIONARY) {
      if (entry.containsPatterns?.some((p) => searchStr.includes(p))) {
        return { merchant_norm: entry.merchant_norm, merchant_group: entry.merchant_group };
      }
    }

    return null;
  }

  private inferCategory(descLower: string, amount: number): CategoryNorm {
    // Keyword-based category inference
    if (descLower.includes('rent') || descLower.includes('mortgage') || descLower.includes('housing')) return 'HOUSING';
    if (descLower.includes('electric') || descLower.includes('water') || descLower.includes('gas bill') || descLower.includes('utility')) return 'UTILITIES';
    if (descLower.includes('insurance') || descLower.includes('insur')) return 'INSURANCE';
    if (descLower.includes('grocery') || descLower.includes('supermarket') || descLower.includes('food')) return 'GROCERIES';
    if (descLower.includes('restaurant') || descLower.includes('cafe') || descLower.includes('coffee') || descLower.includes('pizza') || descLower.includes('burger')) return 'DINING';
    if (descLower.includes('gas station') || descLower.includes('fuel') || descLower.includes('gasoline')) return 'GAS';
    if (descLower.includes('doctor') || descLower.includes('hospital') || descLower.includes('medical') || descLower.includes('pharmacy') || descLower.includes('cvs') || descLower.includes('walgreens')) return 'HEALTHCARE';
    if (descLower.includes('gym') || descLower.includes('salon') || descLower.includes('spa') || descLower.includes('barber')) return 'PERSONAL_CARE';
    if (descLower.includes('movie') || descLower.includes('theater') || descLower.includes('concert') || descLower.includes('ticket')) return 'ENTERTAINMENT';
    if (descLower.includes('airline') || descLower.includes('hotel') || descLower.includes('airbnb') || descLower.includes('booking.com')) return 'TRAVEL';
    if (descLower.includes('tuition') || descLower.includes('school') || descLower.includes('university') || descLower.includes('course')) return 'EDUCATION';
    if (descLower.includes('loan payment') || descLower.includes('student loan') || descLower.includes('car payment') || descLower.includes('min payment')) return 'DEBT_PAYMENT';
    if (descLower.includes('charity') || descLower.includes('donation') || descLower.includes('nonprofit')) return 'CHARITY';
    if (descLower.includes('daycare') || descLower.includes('childcare') || descLower.includes('child care')) return 'CHILDCARE';
    if (descLower.includes('pet') || descLower.includes('vet') || descLower.includes('veterinar')) return 'PETS';

    if (amount > 0) return 'INCOME';
    return 'OTHER';
  }

  private detectTransfer(descLower: string): boolean {
    return TRANSFER_KEYWORDS.some((k) => descLower.includes(k));
  }

  private detectFee(descLower: string): boolean {
    return FEE_KEYWORDS.some((k) => descLower.includes(k));
  }

  private detectInterest(descLower: string): boolean {
    return INTEREST_KEYWORDS.some((k) => descLower.includes(k));
  }

  private detectSameDayTransfers(transactions: TransactionRow[]): void {
    // Group by date
    const byDate = new Map<string, TransactionRow[]>();
    for (const txn of transactions) {
      const dateKey = new Date(txn.postedAt).toISOString().split('T')[0];
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(txn);
    }

    for (const [, dayTxns] of byDate) {
      if (dayTxns.length < 2) continue;

      for (let i = 0; i < dayTxns.length; i++) {
        for (let j = i + 1; j < dayTxns.length; j++) {
          const a = dayTxns[i];
          const b = dayTxns[j];

          // Check if same absolute amount but opposite signs
          if (
            Math.abs(a.amountSigned + b.amountSigned) < 0.01 &&
            a.amountSigned !== 0
          ) {
            // Mark both as suspected transfers if not already classified
            if (!a.isTransfer && (a.confidenceNorm ?? 0) < 0.8) {
              a.isTransfer = true;
              a.categoryNorm = 'TRANSFER';
              a.needsReview = true;
            }
            if (!b.isTransfer && (b.confidenceNorm ?? 0) < 0.8) {
              b.isTransfer = true;
              b.categoryNorm = 'TRANSFER';
              b.needsReview = true;
            }
          }
        }
      }
    }
  }

  private shouldReview(txn: TransactionRow): boolean {
    if ((txn.confidenceNorm ?? 0) < 0.7) return true;
    if (Math.abs(txn.amountSigned) > 500 && (txn.confidenceNorm ?? 0) < 0.9) return true;
    if (txn.isTransfer && (txn.confidenceNorm ?? 0) < 0.8) return true;
    return false;
  }

  private cleanDescription(desc: string): string {
    // Remove common prefixes, numbers, and clean up
    return desc
      .replace(/^(pos|ach|dbt|crd|chk|pmt|txn|ref|sq \*|tst \*)\s*/i, '')
      .replace(/\s+#?\d{4,}.*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
