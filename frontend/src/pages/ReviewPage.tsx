import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const CATEGORIES = [
  'HOUSING', 'UTILITIES', 'INSURANCE', 'GROCERIES', 'DINING', 'TRANSPORT',
  'GAS', 'HEALTHCARE', 'PERSONAL_CARE', 'SHOPPING', 'ENTERTAINMENT',
  'TRAVEL', 'EDUCATION', 'SUBSCRIPTIONS', 'FEES', 'INTEREST',
  'DEBT_PAYMENT', 'INCOME', 'TRANSFER', 'INVESTMENT', 'CHARITY',
  'CHILDCARE', 'PETS', 'OTHER',
];

interface ReviewItem {
  txn_id: string;
  description_raw: string;
  amount_signed: number;
  posted_at: string;
  merchant_group: string | null;
  category_norm: string | null;
  confidence_norm: number;
  is_transfer: boolean;
  is_fee: boolean;
  is_interest: boolean;
  review_reason: string;
}

interface Correction {
  txn_id: string;
  category_norm?: string;
  is_transfer?: boolean;
  is_fee?: boolean;
  is_interest?: boolean;
  always_apply?: boolean;
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [corrections, setCorrections] = useState<Map<string, Correction>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReviewItems();
  }, []);

  async function loadReviewItems() {
    try {
      const result = await api.getReviewItems();
      setItems(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load review items');
    } finally {
      setLoading(false);
    }
  }

  function updateCorrection(txnId: string, field: string, value: any) {
    setCorrections((prev) => {
      const next = new Map(prev);
      const existing = next.get(txnId) || { txn_id: txnId };
      (existing as any)[field] = value;
      next.set(txnId, existing);
      return next;
    });
  }

  const handleSubmit = useCallback(async () => {
    if (corrections.size === 0) {
      navigate('/dashboard');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.submitCorrections([...corrections.values()]);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to submit corrections');
      setSubmitting(false);
    }
  }, [corrections, navigate]);

  const handleRunAnalysis = useCallback(async () => {
    setSubmitting(true);
    setError('');

    try {
      // Submit corrections first if any
      if (corrections.size > 0) {
        await api.submitCorrections([...corrections.values()]);
      }

      // Run analysis
      await api.runAnalysis();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to run analysis');
      setSubmitting(false);
    }
  }, [corrections, navigate]);

  if (loading) return <div className="loading">Loading review items...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Review Transactions</h1>
        <p>
          {items.length > 0
            ? `${items.length} transactions need your review. Correct any misclassifications.`
            : 'No transactions need review. Your data looks clean.'}
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {items.length > 0 && (
        <div style={{ marginBottom: 24, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Date</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Description</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Category</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Transfer</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Fee</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Always</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const correction = corrections.get(item.txn_id);
                return (
                  <tr key={item.txn_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {new Date(item.posted_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.description_raw}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      <span className={item.amount_signed < 0 ? 'money-negative' : 'money-positive'}>
                        ${Math.abs(item.amount_signed).toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        className="input"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        value={correction?.category_norm || item.category_norm || 'OTHER'}
                        onChange={(e) => updateCorrection(item.txn_id, 'category_norm', e.target.value)}
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={correction?.is_transfer ?? item.is_transfer}
                        onChange={(e) => updateCorrection(item.txn_id, 'is_transfer', e.target.checked)}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={correction?.is_fee ?? item.is_fee}
                        onChange={(e) => updateCorrection(item.txn_id, 'is_fee', e.target.checked)}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={correction?.always_apply ?? false}
                        onChange={(e) => updateCorrection(item.txn_id, 'always_apply', e.target.checked)}
                        title="Always apply this correction for similar transactions"
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${
                        item.review_reason === 'low_confidence' ? 'badge-yellow' :
                        item.review_reason === 'high_spend' ? 'badge-red' :
                        'badge-blue'
                      }`}>
                        {item.review_reason.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="btn btn-primary"
          onClick={handleRunAnalysis}
          disabled={submitting}
        >
          {submitting ? 'Processing...' : 'Save & Run Analysis'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {items.length === 0 ? 'Go to Dashboard' : 'Save & Skip Analysis'}
        </button>
      </div>
    </div>
  );
}
