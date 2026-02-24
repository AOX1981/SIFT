import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'choose' | 'csv' | 'plaid' | 'importing' | 'done'>('choose');
  const [csvData, setCsvData] = useState('');
  const [accountName, setAccountName] = useState('');
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<any>(null);

  const handleCsvUpload = useCallback(async () => {
    if (!csvData.trim() || !accountName.trim()) {
      setError('CSV data and account name are required');
      return;
    }

    setError('');
    setStep('importing');

    try {
      const result = await api.importCsv(csvData, accountName);
      setImportResult(result.data);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Import failed');
      setStep('csv');
    }
  }, [csvData, accountName]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvData(ev.target?.result as string);
      if (!accountName) {
        setAccountName(file.name.replace(/\.csv$/i, ''));
      }
    };
    reader.readAsText(file);
  }, [accountName]);

  const handlePlaidConnect = useCallback(async () => {
    setError('');
    try {
      const result = await api.createLinkToken();
      // In production, this would open the Plaid Link UI
      // For now, show a message about configuring Plaid
      setError('Plaid integration requires PLAID_CLIENT_ID and PLAID_SECRET in environment variables. Use CSV import for testing.');
    } catch (err: any) {
      setError(err.message || 'Failed to create link token');
    }
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Import Your Transactions</h1>
        <p>Connect your bank or upload a statement to get started.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {step === 'choose' && (
        <div className="grid grid-2" style={{ maxWidth: 700 }}>
          <div className="card" style={{ cursor: 'pointer' }} onClick={handlePlaidConnect}>
            <h3 style={{ marginBottom: 8 }}>Connect Bank</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              Securely connect via Plaid for automatic transaction sync.
              Supports 12-24 months of history.
            </p>
            <div style={{ marginTop: 16 }}>
              <span className="badge badge-blue">Recommended</span>
            </div>
          </div>

          <div className="card" style={{ cursor: 'pointer' }} onClick={() => setStep('csv')}>
            <h3 style={{ marginBottom: 8 }}>Upload CSV</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              Upload a CSV statement from your bank.
              Must include date, amount, and description.
            </p>
            <div style={{ marginTop: 16 }}>
              <span className="badge badge-purple">Privacy-first</span>
            </div>
          </div>
        </div>
      )}

      {step === 'csv' && (
        <div style={{ maxWidth: 600 }}>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Upload CSV Statement</h3>

            <div style={{ marginBottom: 16 }}>
              <label className="label">Account Name</label>
              <input
                className="input"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., Chase Checking"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label">CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                style={{ fontSize: 14, color: 'var(--color-text-muted)' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label">Or paste CSV data directly</label>
              <textarea
                className="input"
                rows={8}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder={'date,amount,description\n2026-01-15,-45.00,Uber Eats\n2026-01-14,-12.50,Spotify'}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
              />
            </div>

            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Required columns: date, amount, description. Optional: merchant, balance.
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleCsvUpload}>
                Import
              </button>
              <button className="btn btn-secondary" onClick={() => setStep('choose')}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="loading">Processing your transactions...</div>
      )}

      {step === 'done' && importResult && (
        <div style={{ maxWidth: 600 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12, color: 'var(--color-success)' }}>Import Complete</h3>
            <p style={{ marginBottom: 8 }}>
              Imported <strong>{importResult.row_count}</strong> transactions
              {importResult.error_count > 0 && (
                <> ({importResult.error_count} rows skipped)</>
              )}
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => navigate('/review')}>
                Review Transactions
              </button>
              <button className="btn btn-secondary" onClick={() => setStep('choose')}>
                Import More
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
