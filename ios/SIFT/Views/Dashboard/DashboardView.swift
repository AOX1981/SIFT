import SwiftUI

@MainActor
struct DashboardView: View {
    @EnvironmentObject private var apiClient: APIClient
    @EnvironmentObject private var authManager: AuthManager

    @State private var analysis: AnalysisResult?
    @State private var isLoading = false
    @State private var isRunning = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.siftBackground
                    .ignoresSafeArea()

                if isLoading && analysis == nil {
                    ProgressView("Loading analysis...")
                        .tint(.siftAccent)
                        .foregroundColor(.siftTextSecondary)
                } else {
                    ScrollView {
                        VStack(spacing: 20) {
                            if let analysis {
                                // Savings Headline
                                if let savings = analysis.potential_annual_savings, savings >= 1000 {
                                    savingsCard(savings: savings)
                                }

                                // Narration Summary
                                if let narration = analysis.narration {
                                    narrationSection(summary: narration.summary)
                                }

                                // Key Metrics
                                if let signals = analysis.signals {
                                    metricsSection(signals: signals)
                                }

                                // Archetypes
                                if let archetypes = analysis.archetypes, !archetypes.isEmpty {
                                    archetypesSection(archetypes: archetypes)
                                }

                                // Recommendations
                                if let recommendations = analysis.recommendations, !recommendations.isEmpty {
                                    recommendationsSection(recommendations: recommendations)
                                }

                                // Action Plans
                                if let plans = analysis.narration?.action_plans, !plans.isEmpty {
                                    actionPlansSection(plans: plans)
                                }
                            } else if errorMessage == nil {
                                emptyState
                            }

                            // Error
                            if let error = errorMessage {
                                Text(error)
                                    .font(.caption)
                                    .foregroundColor(.siftNegative)
                                    .padding()
                            }

                            // Run Analysis Button
                            runAnalysisButton
                                .padding(.bottom, 32)
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                    }
                    .refreshable {
                        await loadAnalysis()
                    }
                }
            }
            .navigationTitle("Dashboard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button("Logout", role: .destructive) {
                            authManager.logout()
                        }
                    } label: {
                        Image(systemName: "person.circle")
                            .foregroundColor(.siftTextSecondary)
                    }
                }
            }
        }
        .task {
            await loadAnalysis()
        }
    }

    // MARK: - Load Data

    private func loadAnalysis() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await apiClient.getLatestAnalysis()
            analysis = response.data
        } catch let error as APIError {
            if case .httpError(let code, _) = error, code == 404 {
                // No analysis yet, that's OK
                analysis = nil
            } else {
                errorMessage = error.errorDescription
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func runAnalysis() async {
        isRunning = true
        errorMessage = nil
        do {
            let response = try await apiClient.runAnalysis(includeNarration: true)
            analysis = response.data
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        isRunning = false
    }

    // MARK: - Savings Card

    private func savingsCard(savings: Double) -> some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "leaf.fill")
                    .foregroundColor(.siftPositive)
                Text("Potential Savings Found")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.siftPositive)
                Spacer()
            }

            Text("Found \(Formatters.currency(savings))/year")
                .font(.system(.title2, design: .monospaced))
                .fontWeight(.bold)
                .foregroundColor(.siftTextPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(Color.siftSurface)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.siftPositive.opacity(0.5), lineWidth: 1.5)
        )
    }

    // MARK: - Narration Summary

    private func narrationSection(summary: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Summary")
                .font(.headline)
                .foregroundColor(.siftTextPrimary)

            Text(summary)
                .font(.subheadline)
                .foregroundColor(.siftTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.siftSurface)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.siftBorder, lineWidth: 1)
        )
    }

    // MARK: - Metrics Section

    private func metricsSection(signals: AnalyticsSignals) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Key Metrics")
                .font(.headline)
                .foregroundColor(.siftTextPrimary)

            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ], spacing: 12) {
                MetricCard.currency(
                    label: "Net Cash Flow",
                    value: signals.net_cashflow ?? 0
                )

                MetricCard(
                    label: "Savings Rate",
                    value: Formatters.percentage(signals.savings_rate_estimate ?? 0)
                )

                MetricCard(
                    label: "Subscriptions",
                    value: "\(Int(signals.subscription_count ?? 0))",
                    subtitle: Formatters.currency(signals.subscription_total ?? 0) + "/mo"
                )

                MetricCard.currency(
                    label: "Discretionary Burn",
                    value: signals.discretionary_burn_rate ?? 0
                )

                MetricCard.currency(
                    label: "Fees Total",
                    value: signals.fees_total ?? 0
                )

                MetricCard.currency(
                    label: "Interest Total",
                    value: signals.interest_total ?? 0
                )

                MetricCard(
                    label: "Weekend Premium",
                    value: Formatters.percentage(signals.weekend_premium ?? 0)
                )

                MetricCard(
                    label: "Volatility",
                    value: Formatters.scoreDisplay(signals.volatility_score ?? 0)
                )
            }
        }
    }

    // MARK: - Archetypes Section

    private func archetypesSection(archetypes: [Archetype]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Behavioral Archetypes")
                .font(.headline)
                .foregroundColor(.siftTextPrimary)

            ForEach(archetypes) { archetype in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(archetype.label)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.siftAccent)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.siftAccent.opacity(0.15))
                            .cornerRadius(6)

                        Spacer()
                    }

                    Text(archetype.description)
                        .font(.subheadline)
                        .foregroundColor(.siftTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    if let triggers = archetype.triggered_by, !triggers.isEmpty {
                        HStack(spacing: 4) {
                            Text("Triggered by:")
                                .font(.caption2)
                                .foregroundColor(.siftTextSecondary)

                            Text(triggers.joined(separator: ", "))
                                .font(.caption2)
                                .foregroundColor(.siftTextSecondary.opacity(0.8))
                        }
                    }
                }
                .padding(12)
                .background(Color.siftSurface)
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.siftBorder, lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Recommendations Section

    private func recommendationsSection(recommendations: [SavingsRecommendation]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Savings Recommendations")
                .font(.headline)
                .foregroundColor(.siftTextPrimary)

            ForEach(Array(recommendations.enumerated()), id: \.offset) { index, rec in
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .top) {
                        Text("\(index + 1).")
                            .font(.system(.subheadline, design: .monospaced))
                            .foregroundColor(.siftAccent)
                            .frame(width: 24, alignment: .leading)

                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(rec.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(.siftTextPrimary)

                                Spacer()

                                Text(rec.type)
                                    .font(.caption2)
                                    .fontWeight(.medium)
                                    .foregroundColor(typeBadgeColor(rec.type))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(typeBadgeColor(rec.type).opacity(0.15))
                                    .cornerRadius(4)
                            }

                            HStack(spacing: 16) {
                                VStack(alignment: .leading) {
                                    Text("Monthly")
                                        .font(.caption2)
                                        .foregroundColor(.siftTextSecondary)
                                    Text(Formatters.currency(rec.estimated_monthly_savings))
                                        .font(.system(.caption, design: .monospaced))
                                        .foregroundColor(.siftPositive)
                                }

                                VStack(alignment: .leading) {
                                    Text("Annual")
                                        .font(.caption2)
                                        .foregroundColor(.siftTextSecondary)
                                    Text(Formatters.currency(rec.estimated_annual_savings))
                                        .font(.system(.caption, design: .monospaced))
                                        .foregroundColor(.siftPositive)
                                }

                                Spacer()

                                Text(Formatters.confidence(rec.confidence))
                                    .font(.caption2)
                                    .foregroundColor(.siftTextSecondary)
                            }

                            // Steps
                            if let steps = rec.steps, !steps.isEmpty {
                                VStack(alignment: .leading, spacing: 4) {
                                    ForEach(Array(steps.enumerated()), id: \.offset) { stepIdx, step in
                                        HStack(alignment: .top, spacing: 6) {
                                            Text("\(stepIdx + 1).")
                                                .font(.caption2)
                                                .foregroundColor(.siftTextSecondary)
                                                .frame(width: 14, alignment: .trailing)
                                            Text(step)
                                                .font(.caption2)
                                                .foregroundColor(.siftTextSecondary)
                                        }
                                    }
                                }
                                .padding(.top, 4)
                            }
                        }
                    }
                }
                .padding(12)
                .background(Color.siftSurface)
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.siftBorder, lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Action Plans Section

    private func actionPlansSection(plans: [ActionPlan]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Action Plans")
                .font(.headline)
                .foregroundColor(.siftTextPrimary)

            ForEach(plans) { plan in
                VStack(alignment: .leading, spacing: 6) {
                    Text(plan.title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.siftTextPrimary)

                    Text(plan.micro_plan)
                        .font(.caption)
                        .foregroundColor(.siftTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Color.siftSurface)
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.siftBorder, lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
                .frame(height: 60)

            Image(systemName: "chart.bar.doc.horizontal")
                .font(.system(size: 48))
                .foregroundColor(.siftTextSecondary.opacity(0.5))

            Text("No Analysis Yet")
                .font(.title3)
                .fontWeight(.medium)
                .foregroundColor(.siftTextPrimary)

            Text("Import your transactions first, then run analysis to see your spending insights.")
                .font(.subheadline)
                .foregroundColor(.siftTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }

    // MARK: - Run Analysis Button

    private var runAnalysisButton: some View {
        Button {
            Task {
                await runAnalysis()
            }
        } label: {
            HStack(spacing: 8) {
                if isRunning {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "play.fill")
                }
                Text(isRunning ? "Running Analysis..." : "Run Analysis")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Color.siftAccent)
            .foregroundColor(.white)
            .cornerRadius(10)
        }
        .disabled(isRunning)
        .opacity(isRunning ? 0.7 : 1.0)
    }

    // MARK: - Helpers

    private func typeBadgeColor(_ type: String) -> Color {
        switch type {
        case "subscription": return .purple
        case "fee": return .siftNegative
        case "interest": return .orange
        case "price_drift": return .siftWarning
        case "habit_cut": return .blue
        default: return .siftTextSecondary
        }
    }
}

#Preview {
    DashboardView()
        .environmentObject(APIClient.shared)
        .environmentObject(AuthManager())
}
