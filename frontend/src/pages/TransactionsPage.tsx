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
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <select
          className="input"
          style={{ width: 180 }}
          value={filters.category || ''}
          onChange={(e) => setFilter('category', e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.filter(Boolean).map((cat) => (
            <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className="input"
          style={{ width: 140 }}
          value={filters.is_recurring || ''}
          onChange={(e) => setFilter('is_recurring', e.target.value)}
        >
          <option value="">All Types</option>
          <option value="true">Recurring</option>
          <option value="false">One-time</option>
        </select>
        <select
          className="input"
          style={{ width: 140 }}
          value={filters.needs_review || ''}
          onChange={(e) => setFilter('needs_review', e.target.value)}
        >
          <option value="">All Status</option>
          <option value="true">Needs Review</option>
          <option value="false">Reviewed</option>
        </select>
        <input
          className="input"
          style={{ width: 150 }}
          type="date"
          value={filters.date_from || ''}
          onChange={(e) => setFilter('date_from', e.target.value)}
          placeholder="From"
        />
        <input
          className="input"
          style={{ width: 150 }}
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Merchant</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Tags</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={tdStyle}>
                      {new Date(txn.posted_at).toLocaleDateString()}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {txn.description_raw}
                    </td>
                    <td style={tdStyle}>
                      {txn.merchant_norm || '-'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      <span className={txn.amount_signed < 0 ? 'money-negative' : 'money-positive'}>
                        {txn.amount_signed < 0 ? '-' : '+'}${Math.abs(txn.amount_signed).toFixed(2)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="badge badge-purple" style={{ fontSize: 11 }}>
                        {(txn.category_norm || 'OTHER').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {txn.is_recurring && <span className="badge badge-blue" style={{ fontSize: 10 }}>recurring</span>}
                        {txn.is_transfer && <span className="badge badge-yellow" style={{ fontSize: 10 }}>transfer</span>}
                        {txn.is_fee && <span className="badge badge-red" style={{ fontSize: 10 }}>fee</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.total > meta.per_page && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button
                className="btn btn-secondary"
                disabled={meta.page <= 1}
                onClick={() => setPage(meta.page - 1)}
                style={{ padding: '6px 12px', fontSize: 13 }}
              >
                Previous
              </button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                Page {meta.page} of {Math.ceil(meta.total / meta.per_page)}
              </span>
              <button
                className="btn btn-secondary"
                disabled={meta.page >= Math.ceil(meta.total / meta.per_page)}
                onClick={() => setPage(meta.page + 1)}
                style={{ padding: '6px 12px', fontSize: 13 }}
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

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  color: 'var(--color-text-muted)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
};
