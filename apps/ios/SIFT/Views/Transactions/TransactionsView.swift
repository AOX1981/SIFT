import SwiftUI

@MainActor
struct TransactionsView: View {
    @EnvironmentObject private var apiClient: APIClient

    @State private var transactions: [Transaction] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var currentPage = 1
    @State private var totalCount = 0
    @State private var hasMore = true

    // Filters
    @State private var selectedCategory: CategoryNorm?
    @State private var isRecurringFilter: Bool?
    @State private var showFilters = false

    private let perPage = 50

    var body: some View {
        NavigationStack {
            ZStack {
                Color.siftBackground
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Filter bar
                    filterBar

                    if isLoading && transactions.isEmpty {
                        Spacer()
                        ProgressView("Loading transactions...")
                            .tint(.siftAccent)
                            .foregroundColor(.siftTextSecondary)
                        Spacer()
                    } else if transactions.isEmpty {
                        Spacer()
                        emptyState
                        Spacer()
                    } else {
                        // Transaction count
                        HStack {
                            Text("\(totalCount) transactions")
                                .font(.caption)
                                .foregroundColor(.siftTextSecondary)
                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 6)

                        // Transaction list
                        List {
                            ForEach(transactions) { txn in
                                transactionRow(txn)
                                    .listRowBackground(Color.siftSurface)
                                    .listRowSeparatorTint(Color.siftBorder)
                            }

                            if hasMore {
                                HStack {
                                    Spacer()
                                    if isLoading {
                                        ProgressView()
                                            .tint(.siftAccent)
                                    } else {
                                        Button("Load More") {
                                            Task {
                                                await loadMore()
                                            }
                                        }
                                        .foregroundColor(.siftAccent)
                                    }
                                    Spacer()
                                }
                                .listRowBackground(Color.siftBackground)
                                .listRowSeparator(.hidden)
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .refreshable {
                            await refresh()
                        }
                    }
                }

                // Error
                if let error = errorMessage {
                    VStack {
                        Spacer()
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(Color.siftNegative)
                            .cornerRadius(8)
                            .padding(.bottom, 16)
                    }
                }
            }
            .navigationTitle("Transactions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .task {
            await loadTransactions()
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // Category filter
                Menu {
                    Button("All Categories") {
                        selectedCategory = nil
                        Task { await refresh() }
                    }
                    Divider()
                    ForEach(CategoryNorm.allCases) { cat in
                        Button(cat.displayName) {
                            selectedCategory = cat
                            Task { await refresh() }
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "tag")
                        Text(selectedCategory?.displayName ?? "Category")
                    }
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(selectedCategory != nil ? .white : .siftTextSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(selectedCategory != nil ? Color.siftAccent : Color.siftSurface)
                    .cornerRadius(6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.siftBorder, lineWidth: selectedCategory != nil ? 0 : 1)
                    )
                }

                // Recurring filter
                Button {
                    if isRecurringFilter == true {
                        isRecurringFilter = nil
                    } else {
                        isRecurringFilter = true
                    }
                    Task { await refresh() }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "repeat")
                        Text("Recurring")
                    }
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(isRecurringFilter == true ? .white : .siftTextSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(isRecurringFilter == true ? Color.siftAccent : Color.siftSurface)
                    .cornerRadius(6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.siftBorder, lineWidth: isRecurringFilter == true ? 0 : 1)
                    )
                }

                // Clear filters
                if selectedCategory != nil || isRecurringFilter != nil {
                    Button {
                        selectedCategory = nil
                        isRecurringFilter = nil
                        Task { await refresh() }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.siftTextSecondary)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(Color.siftBackground)
    }

    // MARK: - Transaction Row

    private func transactionRow(_ txn: Transaction) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    // Date
                    Text(Formatters.formatDateStringShort(txn.posted_at))
                        .font(.caption2)
                        .foregroundColor(.siftTextSecondary)

                    // Description
                    Text(txn.description_raw)
                        .font(.subheadline)
                        .foregroundColor(.siftTextPrimary)
                        .lineLimit(1)

                    // Merchant
                    if let merchant = txn.merchant_group ?? txn.merchant_norm, !merchant.isEmpty {
                        Text(merchant)
                            .font(.caption)
                            .foregroundColor(.siftTextSecondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Amount
                Text(Formatters.currency(txn.amount_signed))
                    .font(.system(.subheadline, design: .monospaced))
                    .fontWeight(.medium)
                    .foregroundColor(txn.amount_signed >= 0 ? .siftPositive : .siftNegative)
            }

            // Tags
            HStack(spacing: 6) {
                // Category badge
                if let cat = txn.categoryEnum {
                    Text(cat.displayName)
                        .font(.caption2)
                        .foregroundColor(.siftAccent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.siftAccent.opacity(0.12))
                        .cornerRadius(4)
                }

                // Recurring tag
                if txn.is_recurring == true {
                    Text("Recurring")
                        .font(.caption2)
                        .foregroundColor(.purple)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.purple.opacity(0.12))
                        .cornerRadius(4)
                }

                // Transfer tag
                if txn.is_transfer == true {
                    Text("Transfer")
                        .font(.caption2)
                        .foregroundColor(.siftWarning)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.siftWarning.opacity(0.12))
                        .cornerRadius(4)
                }

                // Fee tag
                if txn.is_fee == true {
                    Text("Fee")
                        .font(.caption2)
                        .foregroundColor(.siftNegative)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.siftNegative.opacity(0.12))
                        .cornerRadius(4)
                }

                Spacer()
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray")
                .font(.system(size: 48))
                .foregroundColor(.siftTextSecondary.opacity(0.5))

            Text("No Transactions")
                .font(.title3)
                .fontWeight(.medium)
                .foregroundColor(.siftTextPrimary)

            Text("Import transactions to see them here.")
                .font(.subheadline)
                .foregroundColor(.siftTextSecondary)
        }
    }

    // MARK: - Load Data

    private func loadTransactions() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await apiClient.getTransactions(
                page: currentPage,
                perPage: perPage,
                category: selectedCategory?.rawValue,
                isRecurring: isRecurringFilter
            )
            transactions = response.data
            if let meta = response.meta {
                totalCount = meta.total ?? 0
                hasMore = (meta.page ?? 1) * (meta.per_page ?? perPage) < totalCount
            }
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func loadMore() async {
        currentPage += 1
        isLoading = true
        do {
            let response = try await apiClient.getTransactions(
                page: currentPage,
                perPage: perPage,
                category: selectedCategory?.rawValue,
                isRecurring: isRecurringFilter
            )
            transactions.append(contentsOf: response.data)
            if let meta = response.meta {
                totalCount = meta.total ?? 0
                hasMore = (meta.page ?? 1) * (meta.per_page ?? perPage) < totalCount
            }
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func refresh() async {
        currentPage = 1
        transactions = []
        hasMore = true
        await loadTransactions()
    }
}

#Preview {
    TransactionsView()
        .environmentObject(APIClient.shared)
}
