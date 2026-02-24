import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const CATEGORIES = [
  '', 'HOUSING', 'UTILITIES', 'INSURANCE', 'GROCERIES', 'DINING', 'TRANSPORT',
  'GAS', 'HEALTHCARE', 'PERSONAL_CARE', 'SHOPPING', 'ENTERTAINMENT',
  'TRAVEL', 'EDUCATION', 'SUBSCRIPTIONS', 'FEES', 'INTEREST',
  'DEBT_PAYMENT', 'INCOME', 'TRANSFER', 'OTHER',
];

interface Transaction {
  id: string;
  posted_at: string;
  amount_signed: number;
  description_raw: string;
  merchant_norm: string | null;
  category_norm: string | null;
  is_recurring: boolean;
  is_transfer: boolean;
  is_fee: boolean;
  confidence_norm: number | null;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<{ page: number; per_page: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    page: '1',
    per_page: '50',
  });

  useEffect(() => {
    loadTransactions();
  }, [filters]);

  async function loadTransactions() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(filters)) {
        if (v) params[k] = v;
      }
      const result = await api.getTransactions(params);
      setTransactions(result.data);
      setMeta(result.meta);
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  }

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: '1' }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page: String(page) }));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Transactions</h1>
        <p>{meta ? `${meta.total} total transactions` : 'Loading...'}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          className="input w-[180px]"
          value={filters.category || ''}
          onChange={(e) => setFilter('category', e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.filter(Boolean).map((cat) => (
            <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className="input w-[140px]"
          value={filters.is_recurring || ''}
          onChange={(e) => setFilter('is_recurring', e.target.value)}
        >
          <option value="">All Types</option>
          <option value="true">Recurring</option>
          <option value="false">One-time</option>
        </select>
        <select
          className="input w-[140px]"
          value={filters.needs_review || ''}
          onChange={(e) => setFilter('needs_review', e.target.value)}
        >
          <option value="">All Status</option>
          <option value="true">Needs Review</option>
          <option value="false">Reviewed</option>
        </select>
        <input
          className="input w-[150px]"
          type="date"
          value={filters.date_from || ''}
          onChange={(e) => setFilter('date_from', e.target.value)}
          placeholder="From"
        />
        <input
          className="input w-[150px]"
          type="date"
          value={filters.date_to || ''}
          onChange={(e) => setFilter('date_to', e.target.value)}
          placeholder="To"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading">Loading transactions...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2.5 text-muted font-medium whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2.5 text-muted font-medium whitespace-nowrap">Description</th>
                  <th className="text-left px-3 py-2.5 text-muted font-medium whitespace-nowrap">Merchant</th>
                  <th className="text-right px-3 py-2.5 text-muted font-medium whitespace-nowrap">Amount</th>
                  <th className="text-left px-3 py-2.5 text-muted font-medium whitespace-nowrap">Category</th>
                  <th className="text-left px-3 py-2.5 text-muted font-medium whitespace-nowrap">Tags</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-border">
                    <td className="px-3 py-2.5">
                      {new Date(txn.posted_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5 max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {txn.description_raw}
                    </td>
                    <td className="px-3 py-2.5">
                      {txn.merchant_norm || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <span className={txn.amount_signed < 0 ? 'text-red-400' : 'text-green-400'}>
                        {txn.amount_signed < 0 ? '-' : '+'}${Math.abs(txn.amount_signed).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="badge badge-purple text-[11px]">
                        {(txn.category_norm || 'OTHER').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {txn.is_recurring && <span className="badge badge-blue text-[10px]">recurring</span>}
                        {txn.is_transfer && <span className="badge badge-yellow text-[10px]">transfer</span>}
                        {txn.is_fee && <span className="badge badge-red text-[10px]">fee</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.total > meta.per_page && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                className="btn btn-secondary px-3 py-1.5 text-[13px]"
                disabled={meta.page <= 1}
                onClick={() => setPage(meta.page - 1)}
              >
                Previous
              </button>
              <span className="flex items-center text-[13px] text-muted">
                Page {meta.page} of {Math.ceil(meta.total / meta.per_page)}
              </span>
              <button
                className="btn btn-secondary px-3 py-1.5 text-[13px]"
                disabled={meta.page >= Math.ceil(meta.total / meta.per_page)}
                onClick={() => setPage(meta.page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
