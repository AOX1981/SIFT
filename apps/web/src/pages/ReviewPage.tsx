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
        <div className="mb-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2.5 text-muted font-medium">Date</th>
                <th className="text-left px-3 py-2.5 text-muted font-medium">Description</th>
                <th className="text-right px-3 py-2.5 text-muted font-medium">Amount</th>
                <th className="text-left px-3 py-2.5 text-muted font-medium">Category</th>
                <th className="text-center px-3 py-2.5 text-muted font-medium">Transfer</th>
                <th className="text-center px-3 py-2.5 text-muted font-medium">Fee</th>
                <th className="text-center px-3 py-2.5 text-muted font-medium">Always</th>
                <th className="text-left px-3 py-2.5 text-muted font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const correction = corrections.get(item.txn_id);
                return (
                  <tr key={item.txn_id} className="border-b border-border">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {new Date(item.posted_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5 max-w-[250px] overflow-hidden text-ellipsis">
                      {item.description_raw}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <span className={item.amount_signed < 0 ? 'text-red-400' : 'text-green-400'}>
                        ${Math.abs(item.amount_signed).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        className="input px-2 py-1 text-xs"
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
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={correction?.is_transfer ?? item.is_transfer}
                        onChange={(e) => updateCorrection(item.txn_id, 'is_transfer', e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={correction?.is_fee ?? item.is_fee}
                        onChange={(e) => updateCorrection(item.txn_id, 'is_fee', e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={correction?.always_apply ?? false}
                        onChange={(e) => updateCorrection(item.txn_id, 'always_apply', e.target.checked)}
                        title="Always apply this correction for similar transactions"
                      />
                    </td>
                    <td className="px-3 py-2.5">
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

      <div className="flex gap-3">
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
