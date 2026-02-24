import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface AnalysisResult {
  signals: Record<string, any>;
  archetypes: Array<{ name: string; label: string; description: string; triggered_by: string[]; signal_values: Record<string, number> }>;
  recommendations: Array<{
    title: string;
    type: string;
    estimated_monthly_savings: number;
    estimated_annual_savings: number;
    confidence: number;
    proof: Array<{ txn_id: string; description: string; amount: number; date: string }>;
    steps: string[];
    score: number;
  }>;
  potential_annual_savings: number | null;
  period_start: string;
  period_end: string;
  narration: {
    summary: string;
    archetype_narratives: Array<{ name: string; narrative: string }>;
    action_plans: Array<{ title: string; micro_plan: string }>;
  } | null;
}

export default function DashboardPage() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalysis();
  }, []);

  async function loadAnalysis() {
    try {
      const result = await api.getLatestAnalysis();
      setAnalysis(result.data);
    } catch {
      // No analysis yet — that's fine
    } finally {
      setLoading(false);
    }
  }

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError('');
    try {
      const result = await api.runAnalysis();
      setAnalysis(result.data);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  if (!analysis) {
    return (
      <div>
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Import your transactions to see your spending analysis.</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        <button className="btn btn-primary" onClick={runAnalysis} disabled={analyzing}>
          {analyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>
    );
  }

  const { signals, archetypes, recommendations, potential_annual_savings, narration } = analysis;

  return (
    <div>
      <div className="page-header">
        <h1>Your Spending Analysis</h1>
        <p>Period: {analysis.period_start} to {analysis.period_end}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Savings headline */}
      {potential_annual_savings && potential_annual_savings >= 1000 && (
        <div className="card mb-6 border-green-500/40 bg-green-500/5">
          <p className="text-muted text-[13px] mb-1">Potential Annual Savings</p>
          <p className="text-4xl font-bold font-mono text-green-400">
            ${potential_annual_savings.toLocaleString()}
          </p>
          <p className="text-[13px] text-muted mt-1">
            Conservative estimate with 15% safety haircut applied
          </p>
        </div>
      )}

      {/* Narration summary */}
      {narration?.summary && (
        <div className="card mb-6">
          <p className="text-[15px] leading-relaxed">{narration.summary}</p>
        </div>
      )}

      {/* Key Signals */}
      <h2 className="text-base font-semibold mb-3">Key Metrics</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Net Cashflow (90d)"
          value={`$${signals.net_cashflow?.toLocaleString()}`}
          positive={signals.net_cashflow >= 0}
        />
        <MetricCard
          label="Savings Rate"
          value={`${Math.round((signals.savings_rate_estimate || 0) * 100)}%`}
          positive={signals.savings_rate_estimate > 0.1}
        />
        <MetricCard
          label="Subscriptions"
          value={`${signals.subscription_count} ($${signals.subscription_total?.toFixed(0)}/mo)`}
        />
        <MetricCard
          label="Discretionary Burn"
          value={`$${signals.discretionary_burn_rate?.toFixed(0)}/mo`}
        />
        <MetricCard
          label="Fees (90d)"
          value={`$${signals.fees_total?.toFixed(2)}`}
          positive={signals.fees_total === 0}
        />
        <MetricCard
          label="Interest (90d)"
          value={`$${signals.interest_total?.toFixed(2)}`}
          positive={signals.interest_total === 0}
        />
        <MetricCard
          label="Weekend Premium"
          value={`${Math.round((signals.weekend_premium || 0) * 100)}%`}
        />
        <MetricCard
          label="Spending Volatility"
          value={signals.volatility_score?.toFixed(0)}
        />
      </div>

      {/* Archetypes */}
      {archetypes.length > 0 && (
        <>
          <h2 className="text-base font-semibold mb-3">Your Behavioral Patterns</h2>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {archetypes.map((arch) => (
              <div className="card" key={arch.name}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-purple">{arch.label}</span>
                </div>
                <p className="text-sm text-muted leading-relaxed">
                  {narration?.archetype_narratives?.find((n) => n.name === arch.name)?.narrative || arch.description}
                </p>
                <div className="mt-3 text-xs text-muted">
                  Triggered by: {arch.triggered_by.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <>
          <h2 className="text-base font-semibold mb-3">Savings Actions</h2>
          <div className="flex flex-col gap-4 mb-8">
            {recommendations.map((rec, i) => (
              <div className="card" key={i}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-[15px] font-semibold mb-1">
                      {i + 1}. {rec.title}
                    </h3>
                    <span className={`badge ${
                      rec.type === 'subscription' ? 'badge-purple' :
                      rec.type === 'fee' ? 'badge-red' :
                      rec.type === 'interest' ? 'badge-yellow' :
                      rec.type === 'price_drift' ? 'badge-blue' :
                      'badge-green'
                    }`}>
                      {rec.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-green-400">
                      ${rec.estimated_monthly_savings.toFixed(2)}/mo
                    </p>
                    <p className="text-xs text-muted">
                      ${rec.estimated_annual_savings.toFixed(0)}/yr
                    </p>
                  </div>
                </div>

                <div className="mb-3">
                  {rec.steps.map((step, j) => (
                    <p key={j} className="text-[13px] text-muted py-0.5">
                      {j + 1}. {step}
                    </p>
                  ))}
                </div>

                <div className="text-xs text-muted">
                  Confidence: {Math.round(rec.confidence * 100)}% | Based on {rec.proof.length} transaction{rec.proof.length !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Re-run */}
      <button className="btn btn-secondary" onClick={runAnalysis} disabled={analyzing}>
        {analyzing ? 'Re-analyzing...' : 'Re-run Analysis'}
      </button>
    </div>
  );
}

function MetricCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-lg font-semibold font-mono ${
        positive === true ? 'text-green-400' :
        positive === false ? 'text-red-400' :
        'text-gray-100'
      }`}>
        {value}
      </p>
    </div>
  );
}
