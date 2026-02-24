import SwiftUI

@MainActor
struct ReviewView: View {
    @EnvironmentObject private var apiClient: APIClient

    @State private var reviewItems: [ReviewItem] = []
    @State private var corrections: [String: CorrectionState] = [:]
    @State private var isLoading = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    struct CorrectionState {
        var category: CategoryNorm?
        var isTransfer: Bool
        var isFee: Bool
        var isInterest: Bool
        var alwaysApply: Bool = false
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.siftBackground
                    .ignoresSafeArea()

                if isLoading && reviewItems.isEmpty {
                    ProgressView("Loading review items...")
                        .tint(.siftAccent)
                        .foregroundColor(.siftTextSecondary)
                } else if reviewItems.isEmpty {
                    emptyState
                } else {
                    VStack(spacing: 0) {
                        // Header info
                        HStack {
                            Text("\(reviewItems.count) items to review")
                                .font(.subheadline)
                                .foregroundColor(.siftTextSecondary)
                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)

                        // Review List
                        List {
                            ForEach(reviewItems) { item in
                                reviewRow(item: item)
                                    .listRowBackground(Color.siftSurface)
                                    .listRowSeparatorTint(Color.siftBorder)
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)

                        // Bottom Actions
                        bottomActions
                    }
                }

                // Success overlay
                if let success = successMessage {
                    VStack {
                        Spacer()
                        Text(success)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .background(Color.siftPositive)
                            .cornerRadius(10)
                            .padding(.bottom, 100)
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(.easeInOut, value: successMessage)
                }
            }
            .navigationTitle("Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .task {
            await loadReviewItems()
        }
    }

    // MARK: - Review Row

    private func reviewRow(item: ReviewItem) -> some View {
        let state = corrections[item.txn_id] ?? CorrectionState(
            category: item.category_norm.flatMap { CategoryNorm(rawValue: $0) },
            isTransfer: item.is_transfer,
            isFee: item.is_fee,
            isInterest: item.is_interest
        )

        return VStack(alignment: .leading, spacing: 10) {
            // Top row: date, description, amount
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(Formatters.formatDateStringShort(item.posted_at))
                        .font(.caption2)
                        .foregroundColor(.siftTextSecondary)

                    Text(item.description_raw)
                        .font(.subheadline)
                        .foregroundColor(.siftTextPrimary)
                        .lineLimit(2)

                    Text(item.review_reason.replacingOccurrences(of: "_", with: " "))
                        .font(.caption2)
                        .foregroundColor(.siftWarning)
                }

                Spacer()

                Text(Formatters.currency(item.amount_signed))
                    .font(.system(.subheadline, design: .monospaced))
                    .fontWeight(.medium)
                    .foregroundColor(item.amount_signed >= 0 ? .siftPositive : .siftNegative)
            }

            Divider()
                .background(Color.siftBorder)

            // Category picker
            HStack {
                Text("Category")
                    .font(.caption)
                    .foregroundColor(.siftTextSecondary)

                Spacer()

                Picker("Category", selection: Binding(
                    get: { state.category ?? .OTHER },
                    set: { newValue in
                        var s = state
                        s.category = newValue
                        corrections[item.txn_id] = s
                    }
                )) {
                    ForEach(CategoryNorm.allCases) { cat in
                        Text(cat.displayName)
                            .tag(cat)
                    }
                }
                .pickerStyle(.menu)
                .tint(.siftAccent)
            }

            // Toggle row
            HStack(spacing: 16) {
                toggleChip(label: "Transfer", isOn: Binding(
                    get: { state.isTransfer },
                    set: { val in
                        var s = state
                        s.isTransfer = val
                        corrections[item.txn_id] = s
                    }
                ))

                toggleChip(label: "Fee", isOn: Binding(
                    get: { state.isFee },
                    set: { val in
                        var s = state
                        s.isFee = val
                        corrections[item.txn_id] = s
                    }
                ))

                toggleChip(label: "Interest", isOn: Binding(
                    get: { state.isInterest },
                    set: { val in
                        var s = state
                        s.isInterest = val
                        corrections[item.txn_id] = s
                    }
                ))

                Spacer()

                toggleChip(label: "Always", isOn: Binding(
                    get: { state.alwaysApply },
                    set: { val in
                        var s = state
                        s.alwaysApply = val
                        corrections[item.txn_id] = s
                    }
                ), activeColor: .siftAccent)
            }
        }
        .padding(.vertical, 8)
    }

    // MARK: - Toggle Chip

    private func toggleChip(label: String, isOn: Binding<Bool>, activeColor: Color = .siftWarning) -> some View {
        Button {
            isOn.wrappedValue.toggle()
        } label: {
            Text(label)
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundColor(isOn.wrappedValue ? .white : .siftTextSecondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(isOn.wrappedValue ? activeColor : Color.siftBorder.opacity(0.5))
                .cornerRadius(4)
        }
    }

    // MARK: - Bottom Actions

    private var bottomActions: some View {
        HStack(spacing: 12) {
            // Skip Button
            Button {
                Task {
                    await loadReviewItems()
                }
            } label: {
                Text("Skip")
                    .fontWeight(.medium)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .foregroundColor(.siftTextSecondary)
                    .background(Color.siftSurface)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.siftBorder, lineWidth: 1)
                    )
            }

            // Save & Run Analysis Button
            Button {
                Task {
                    await submitCorrections()
                }
            } label: {
                HStack(spacing: 6) {
                    if isSubmitting {
                        ProgressView()
                            .tint(.white)
                    }
                    Text(isSubmitting ? "Saving..." : "Save & Run Analysis")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .foregroundColor(.white)
                .background(Color.siftAccent)
                .cornerRadius(8)
            }
            .disabled(isSubmitting || corrections.isEmpty)
            .opacity(corrections.isEmpty ? 0.6 : 1.0)
        }
        .padding(16)
        .background(Color.siftBackground)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 48))
                .foregroundColor(.siftPositive)

            Text("All Caught Up")
                .font(.title3)
                .fontWeight(.medium)
                .foregroundColor(.siftTextPrimary)

            Text("No transactions need review right now.")
                .font(.subheadline)
                .foregroundColor(.siftTextSecondary)
        }
    }

    // MARK: - Load Data

    private func loadReviewItems() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await apiClient.getReviewItems()
            reviewItems = response.data
            corrections = [:]
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Submit Corrections

    private func submitCorrections() async {
        guard !corrections.isEmpty else { return }
        isSubmitting = true
        errorMessage = nil

        let correctionsList = corrections.map { txnId, state in
            TransactionCorrection(
                txn_id: txnId,
                category_norm: state.category?.rawValue,
                is_transfer: state.isTransfer,
                is_fee: state.isFee,
                is_interest: state.isInterest,
                always_apply: state.alwaysApply ? true : nil
            )
        }

        do {
            let response = try await apiClient.submitCorrections(correctionsList)
            let result = response.data
            successMessage = "Updated \(result.updated_count) transactions, \(result.rules_created) rules created"

            // Reload review items
            await loadReviewItems()

            // Auto-dismiss success message
            Task {
                try? await Task.sleep(for: .seconds(3))
                successMessage = nil
            }
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }

        isSubmitting = false
    }
}

#Preview {
    ReviewView()
        .environmentObject(APIClient.shared)
}
