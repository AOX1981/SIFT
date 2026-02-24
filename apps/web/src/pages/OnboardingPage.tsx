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
        <div className="grid grid-cols-2 gap-6 max-w-[700px]">
          <div className="card cursor-pointer hover:border-indigo-500/50 transition-colors" onClick={handlePlaidConnect}>
            <h3 className="mb-2">Connect Bank</h3>
            <p className="text-muted text-sm">
              Securely connect via Plaid for automatic transaction sync.
              Supports 12-24 months of history.
            </p>
            <div className="mt-4">
              <span className="badge badge-blue">Recommended</span>
            </div>
          </div>

          <div className="card cursor-pointer hover:border-indigo-500/50 transition-colors" onClick={() => setStep('csv')}>
            <h3 className="mb-2">Upload CSV</h3>
            <p className="text-muted text-sm">
              Upload a CSV statement from your bank.
              Must include date, amount, and description.
            </p>
            <div className="mt-4">
              <span className="badge badge-purple">Privacy-first</span>
            </div>
          </div>
        </div>
      )}

      {step === 'csv' && (
        <div className="max-w-[600px]">
          <div className="card">
            <h3 className="mb-4">Upload CSV Statement</h3>

            <div className="mb-4">
              <label className="label">Account Name</label>
              <input
                className="input"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., Chase Checking"
              />
            </div>

            <div className="mb-4">
              <label className="label">CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="text-sm text-muted"
              />
            </div>

            <div className="mb-4">
              <label className="label">Or paste CSV data directly</label>
              <textarea
                className="input font-mono text-xs"
                rows={8}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder={'date,amount,description\n2026-01-15,-45.00,Uber Eats\n2026-01-14,-12.50,Spotify'}
              />
            </div>

            <p className="text-xs text-muted mb-4">
              Required columns: date, amount, description. Optional: merchant, balance.
            </p>

            <div className="flex gap-3">
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
        <div className="max-w-[600px]">
          <div className="card">
            <h3 className="mb-3 text-green-400">Import Complete</h3>
            <p className="mb-2">
              Imported <strong>{importResult.row_count}</strong> transactions
              {importResult.error_count > 0 && (
                <> ({importResult.error_count} rows skipped)</>
              )}
            </p>
            <div className="flex gap-3 mt-4">
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
