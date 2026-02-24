import { parse } from 'csv-parse/sync';
import { AppError } from '../middleware/errorHandler';

/**
 * Engine 2: Parsing Engine
 * CSV rules: Require date, amount, description. Strict mapping. Reject ambiguous formats.
 * PDF rules: Table extraction only. Low confidence → reject.
 */

interface ParsedTransaction {
  posted_at: Date;
  amount_signed: number;
  description_raw: string;
  merchant_raw?: string;
  currency?: string;
  balance_after?: number;
}

// Known column name variations
const DATE_COLUMNS = ['date', 'posted_at', 'transaction_date', 'trans_date', 'posting_date', 'post_date'];
const AMOUNT_COLUMNS = ['amount', 'amount_signed', 'transaction_amount', 'debit', 'credit'];
const DESCRIPTION_COLUMNS = ['description', 'description_raw', 'memo', 'narrative', 'details', 'transaction_description', 'name'];
const MERCHANT_COLUMNS = ['merchant', 'merchant_name', 'payee', 'vendor'];
const BALANCE_COLUMNS = ['balance', 'balance_after', 'running_balance'];

export class ParsingEngine {
  /**
   * Parse CSV data into canonical transaction format.
   * Requires: date, amount, description columns.
   */
  parseCsv(csvData: string): ParsedTransaction[] {
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    if (!records || records.length === 0) {
      throw new AppError(400, 'EMPTY_CSV', 'CSV file contains no data rows');
    }

    // Detect column mapping
    const headers = Object.keys(records[0]).map((h) => h.toLowerCase().trim());
    const mapping = this.detectColumnMapping(headers, Object.keys(records[0]));

    if (!mapping.date || !mapping.amount || !mapping.description) {
      const missing: string[] = [];
      if (!mapping.date) missing.push('date');
      if (!mapping.amount) missing.push('amount');
      if (!mapping.description) missing.push('description');
      throw new AppError(
        400,
        'MISSING_COLUMNS',
        `CSV missing required columns: ${missing.join(', ')}. Found: ${headers.join(', ')}`,
      );
    }

    const transactions: ParsedTransaction[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];

      try {
        const dateStr = row[mapping.date];
        const amountStr = row[mapping.amount];
        const description = row[mapping.description];

        // Parse date
        const postedAt = this.parseDate(dateStr);
        if (!postedAt) {
          errors.push({ row: i + 2, message: `Invalid date: ${dateStr}` });
          continue;
        }

        // Parse amount
        const amountSigned = this.parseAmount(
          amountStr,
          mapping.debit ? row[mapping.debit] : undefined,
          mapping.credit ? row[mapping.credit] : undefined,
        );
        if (amountSigned === null) {
          errors.push({ row: i + 2, message: `Invalid amount: ${amountStr}` });
          continue;
        }

        if (!description || description.trim().length === 0) {
          errors.push({ row: i + 2, message: 'Empty description' });
          continue;
        }

        const txn: ParsedTransaction = {
          posted_at: postedAt,
          amount_signed: amountSigned,
          description_raw: description.trim(),
        };

        if (mapping.merchant) {
          txn.merchant_raw = row[mapping.merchant]?.trim() || undefined;
        }

        if (mapping.balance) {
          const bal = parseFloat(row[mapping.balance]?.replace(/[,$]/g, ''));
          if (!isNaN(bal)) txn.balance_after = bal;
        }

        transactions.push(txn);
      } catch (err) {
        errors.push({
          row: i + 2,
          message: err instanceof Error ? err.message : 'Parse error',
        });
      }
    }

    if (transactions.length === 0) {
      throw new AppError(
        400,
        'NO_VALID_ROWS',
        `No valid transactions found. ${errors.length} rows had errors.`,
      );
    }

    return transactions;
  }

  private detectColumnMapping(
    headersLower: string[],
    headersOriginal: string[],
  ): {
    date?: string;
    amount?: string;
    debit?: string;
    credit?: string;
    description?: string;
    merchant?: string;
    balance?: string;
  } {
    const mapping: Record<string, string | undefined> = {};

    for (let i = 0; i < headersLower.length; i++) {
      const h = headersLower[i];
      const original = headersOriginal[i];

      if (!mapping.date && DATE_COLUMNS.includes(h)) mapping.date = original;
      if (!mapping.description && DESCRIPTION_COLUMNS.includes(h)) mapping.description = original;
      if (!mapping.merchant && MERCHANT_COLUMNS.includes(h)) mapping.merchant = original;
      if (!mapping.balance && BALANCE_COLUMNS.includes(h)) mapping.balance = original;

      if (h === 'debit') mapping.debit = original;
      if (h === 'credit') mapping.credit = original;
      if (!mapping.amount && AMOUNT_COLUMNS.includes(h) && h !== 'debit' && h !== 'credit') {
        mapping.amount = original;
      }
    }

    // If we have debit/credit columns but no amount column, use debit as the amount source
    if (!mapping.amount && mapping.debit) {
      mapping.amount = mapping.debit;
    }

    return mapping;
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.trim().length === 0) return null;

    const cleaned = dateStr.trim();

    // Try ISO format first
    const isoDate = new Date(cleaned);
    if (!isNaN(isoDate.getTime())) return isoDate;

    // Try MM/DD/YYYY
    const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      const year = slashMatch[3].length === 2 ? 2000 + parseInt(slashMatch[3]) : parseInt(slashMatch[3]);
      return new Date(year, parseInt(slashMatch[1]) - 1, parseInt(slashMatch[2]));
    }

    // Try DD-MM-YYYY or YYYY-MM-DD
    const dashMatch = cleaned.match(/^(\d{1,4})-(\d{1,2})-(\d{1,4})$/);
    if (dashMatch) {
      if (dashMatch[1].length === 4) {
        // YYYY-MM-DD
        return new Date(parseInt(dashMatch[1]), parseInt(dashMatch[2]) - 1, parseInt(dashMatch[3]));
      } else {
        // DD-MM-YYYY
        return new Date(parseInt(dashMatch[3]), parseInt(dashMatch[2]) - 1, parseInt(dashMatch[1]));
      }
    }

    return null;
  }

  private parseAmount(
    amountStr?: string,
    debitStr?: string,
    creditStr?: string,
  ): number | null {
    // If we have separate debit/credit columns
    if (debitStr !== undefined && creditStr !== undefined) {
      const debit = this.cleanNumber(debitStr);
      const credit = this.cleanNumber(creditStr);

      if (debit !== null && debit > 0) return -debit; // outflow negative
      if (credit !== null && credit > 0) return credit; // inflow positive
      if (debit === 0 && credit === 0) return 0;

      // One of them should be non-empty
      if (debit !== null) return -Math.abs(debit);
      if (credit !== null) return Math.abs(credit);
    }

    // Single amount column
    if (!amountStr) return null;
    return this.cleanNumber(amountStr);
  }

  private cleanNumber(str: string): number | null {
    if (!str || str.trim().length === 0) return null;
    // Remove currency symbols, commas, spaces
    const cleaned = str.trim().replace(/[$€£,\s]/g, '');
    // Handle parentheses as negative: (123.45) → -123.45
    const parenMatch = cleaned.match(/^\((.+)\)$/);
    if (parenMatch) {
      const num = parseFloat(parenMatch[1]);
      return isNaN(num) ? null : -num;
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
}
