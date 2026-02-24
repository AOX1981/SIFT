const API_BASE = '/v1';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: { code: 'UNKNOWN', message: response.statusText },
      }));
      throw new ApiError(response.status, error.error?.code || 'UNKNOWN', error.error?.message || 'An error occurred');
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  // Auth
  async register(email: string, password: string, name?: string) {
    return this.request<{ data: { user: any; token: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ data: { user: any; token: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Plaid
  async createLinkToken() {
    return this.request<{ data: { link_token: string; expiration: string } }>('/plaid/link-token', {
      method: 'POST',
    });
  }

  async exchangePublicToken(publicToken: string) {
    return this.request<{ data: { connection_id: string; accounts: any[]; import_job_id: string } }>('/plaid/exchange', {
      method: 'POST',
      body: JSON.stringify({ public_token: publicToken }),
    });
  }

  // Import
  async importCsv(csvData: string, accountName: string, accountType?: string) {
    return this.request<{ data: any }>('/import/csv', {
      method: 'POST',
      body: JSON.stringify({ csv_data: csvData, account_name: accountName, account_type: accountType }),
    });
  }

  async getImportJob(jobId: string) {
    return this.request<{ data: any }>(`/import/${jobId}`);
  }

  // Accounts
  async getAccounts() {
    return this.request<{ data: any[] }>('/accounts');
  }

  // Transactions
  async getTransactions(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ data: any[]; meta: any }>(`/transactions${query}`);
  }

  // Review
  async getReviewItems() {
    return this.request<{ data: any[] }>('/review');
  }

  async submitCorrections(corrections: any[]) {
    return this.request<{ data: { updated_count: number; rules_created: number } }>('/review/corrections', {
      method: 'POST',
      body: JSON.stringify({ corrections }),
    });
  }

  // Recurring
  async getRecurring() {
    return this.request<{ data: any[] }>('/recurring');
  }

  async confirmRecurring(id: string, confirmed: boolean, requiredness?: string) {
    return this.request<{ data: any }>(`/recurring/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmed, requiredness }),
    });
  }

  // Analysis
  async runAnalysis(includeNarration = true) {
    return this.request<{ data: any }>('/analysis', {
      method: 'POST',
      body: JSON.stringify({ include_narration: includeNarration }),
    });
  }

  async getLatestAnalysis() {
    return this.request<{ data: any }>('/analysis/latest');
  }

  async getAnalysisHistory(page = 1) {
    return this.request<{ data: any[]; meta: any }>(`/analysis/history?page=${page}`);
  }

  // User
  async getUserRules() {
    return this.request<{ data: any[] }>('/user/rules');
  }

  async deleteUserRule(id: string) {
    return this.request<{}>(`/user/rules?id=${id}`, { method: 'DELETE' });
  }

  async deleteAccount() {
    return this.request<{}>('/user/delete', { method: 'DELETE' });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient();
