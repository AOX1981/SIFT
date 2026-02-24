import { prisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Engine 1: Connection Engine
 * Handles Plaid connect and CSV upload.
 * Output: raw_transactions[] in canonical format.
 */
export class ConnectionEngine {
  private plaidClientId = process.env.PLAID_CLIENT_ID || '';
  private plaidSecret = process.env.PLAID_SECRET || '';
  private plaidEnv = process.env.PLAID_ENV || 'sandbox';

  private getPlaidBaseUrl(): string {
    switch (this.plaidEnv) {
      case 'production':
        return 'https://production.plaid.com';
      case 'development':
        return 'https://development.plaid.com';
      default:
        return 'https://sandbox.plaid.com';
    }
  }

  private async plaidRequest(path: string, body: Record<string, unknown>): Promise<any> {
    const url = `${this.getPlaidBaseUrl()}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.plaidClientId,
        secret: this.plaidSecret,
        ...body,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new AppError(
        502,
        'PLAID_ERROR',
        `Plaid API error: ${err.error_message || response.statusText}`,
      );
    }

    return response.json();
  }

  async createLinkToken(userId: string): Promise<{ link_token: string; expiration: string }> {
    const result = await this.plaidRequest('/link/token/create', {
      user: { client_user_id: userId },
      client_name: 'SIFT',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });

    return {
      link_token: result.link_token,
      expiration: result.expiration,
    };
  }

  async exchangePublicToken(
    userId: string,
    publicToken: string,
  ): Promise<{
    connection_id: string;
    accounts: Array<Record<string, unknown>>;
    import_job_id: string;
  }> {
    // Exchange public token for access token
    const exchangeResult = await this.plaidRequest('/item/public_token/exchange', {
      public_token: publicToken,
    });

    const accessToken = exchangeResult.access_token;
    const itemId = exchangeResult.item_id;

    // Get item info
    const itemResult = await this.plaidRequest('/item/get', {
      access_token: accessToken,
    });

    // Create connection
    const connection = await prisma.plaidConnection.create({
      data: {
        userId,
        accessToken,
        itemId,
        institutionId: itemResult.item?.institution_id,
        status: 'active',
      },
    });

    // Get accounts
    const accountsResult = await this.plaidRequest('/accounts/get', {
      access_token: accessToken,
    });

    const accounts = [];
    for (const plaidAccount of accountsResult.accounts || []) {
      const account = await prisma.account.create({
        data: {
          userId,
          plaidConnectionId: connection.id,
          plaidAccountId: plaidAccount.account_id,
          name: plaidAccount.name,
          officialName: plaidAccount.official_name,
          type: plaidAccount.type,
          subtype: plaidAccount.subtype,
          mask: plaidAccount.mask,
          currentBalance: plaidAccount.balances?.current,
          availableBalance: plaidAccount.balances?.available,
          isoCurrencyCode: plaidAccount.balances?.iso_currency_code,
          source: 'plaid',
        },
      });
      accounts.push({
        id: account.id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        source: account.source,
      });
    }

    // Create import job and start sync
    const importJob = await prisma.importJob.create({
      data: {
        userId,
        source: 'PLAID',
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    });

    // Sync transactions (runs inline for V1, background job in production)
    this.syncTransactionsForConnection(connection.id, accessToken, importJob.id).catch(
      (err) => {
        console.error('Sync error:', err);
        prisma.importJob.update({
          where: { id: importJob.id },
          data: { status: 'FAILED', errors: [{ message: String(err) }] },
        });
      },
    );

    return {
      connection_id: connection.id,
      accounts,
      import_job_id: importJob.id,
    };
  }

  async syncTransactions(connectionId: string): Promise<void> {
    const connection = await prisma.plaidConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new AppError(404, 'NOT_FOUND', 'Connection not found');
    }

    const importJob = await prisma.importJob.create({
      data: {
        userId: connection.userId,
        source: 'PLAID',
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    });

    await this.syncTransactionsForConnection(
      connectionId,
      connection.accessToken,
      importJob.id,
    );
  }

  private async syncTransactionsForConnection(
    connectionId: string,
    accessToken: string,
    importJobId: string,
  ): Promise<void> {
    const connection = await prisma.plaidConnection.findUnique({
      where: { id: connectionId },
      include: { accounts: true },
    });

    if (!connection) return;

    // Build account ID map
    const accountMap = new Map<string, string>();
    for (const account of connection.accounts) {
      if (account.plaidAccountId) {
        accountMap.set(account.plaidAccountId, account.id);
      }
    }

    let hasMore = true;
    let cursor = connection.cursor || undefined;
    let rowCount = 0;

    while (hasMore) {
      const body: Record<string, unknown> = { access_token: accessToken };
      if (cursor) {
        body.cursor = cursor;
      }

      const result = await this.plaidRequest('/transactions/sync', body);

      // Process added transactions
      for (const txn of result.added || []) {
        const accountId = accountMap.get(txn.account_id);
        if (!accountId) continue;

        // Plaid uses positive for debits, we use negative for outflows
        const amountSigned = -txn.amount;

        await prisma.transaction.upsert({
          where: { plaidTxnId: txn.transaction_id },
          create: {
            accountId,
            source: 'BANK',
            plaidTxnId: txn.transaction_id,
            postedAt: new Date(txn.date),
            amountSigned,
            currency: txn.iso_currency_code || 'USD',
            descriptionRaw: txn.name || txn.merchant_name || '',
            merchantRaw: txn.merchant_name,
            categoryRaw: txn.personal_finance_category?.primary,
            counterpartyRaw: txn.counterparties?.[0] || null,
            importJobId,
          },
          update: {
            amountSigned,
            descriptionRaw: txn.name || txn.merchant_name || '',
            merchantRaw: txn.merchant_name,
            categoryRaw: txn.personal_finance_category?.primary,
            counterpartyRaw: txn.counterparties?.[0] || null,
          },
        });
        rowCount++;
      }

      // Handle removed transactions
      for (const txn of result.removed || []) {
        await prisma.transaction.deleteMany({
          where: { plaidTxnId: txn.transaction_id },
        });
      }

      cursor = result.next_cursor;
      hasMore = result.has_more;
    }

    // Update connection cursor
    await prisma.plaidConnection.update({
      where: { id: connectionId },
      data: { cursor, lastSyncAt: new Date() },
    });

    // Update import job
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'COMPLETED',
        rowCount,
        completedAt: new Date(),
      },
    });
  }
}
