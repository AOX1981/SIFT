import SwiftUI

@MainActor
struct OnboardingView: View {
    @EnvironmentObject private var apiClient: APIClient

    @State private var selectedMode: ImportMode? = nil
    @State private var accountName = ""
    @State private var accountType = "checking"
    @State private var csvData = ""
    @State private var isImporting = false
    @State private var importResult: String?
    @State private var importError: String?
    @State private var showReview = false

    enum ImportMode: String, Identifiable {
        case plaid = "plaid"
        case csv = "csv"
        var id: String { rawValue }
    }

    private let accountTypes = ["checking", "savings", "credit", "investment", "other"]

    var body: some View {
        NavigationStack {
            ZStack {
                Color.siftBackground
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Header
                        VStack(spacing: 4) {
                            Text("Import Transactions")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(.siftTextPrimary)

                            Text("Choose how to get your data into SIFT")
                                .font(.subheadline)
                                .foregroundColor(.siftTextSecondary)
                        }
                        .padding(.top, 8)

                        // Option Cards
                        if selectedMode == nil {
                            optionCards
                        }

                        // Plaid Flow
                        if selectedMode == .plaid {
                            plaidFlow
                        }

                        // CSV Flow
                        if selectedMode == .csv {
                            csvFlow
                        }

                        // Result
                        if let result = importResult {
                            resultCard(result)
                        }

                        // Error
                        if let error = importError {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.siftNegative)
                                .padding()
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("Import")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .navigationDestination(isPresented: $showReview) {
                ReviewView()
            }
        }
    }

    // MARK: - Option Cards

    private var optionCards: some View {
        VStack(spacing: 12) {
            // Connect Bank Card
            Button {
                selectedMode = .plaid
            } label: {
                HStack(spacing: 16) {
                    Image(systemName: "building.columns.fill")
                        .font(.title2)
                        .foregroundColor(.siftAccent)
                        .frame(width: 44, height: 44)
                        .background(Color.siftAccent.opacity(0.15))
                        .cornerRadius(10)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Connect Bank")
                            .font(.headline)
                            .foregroundColor(.siftTextPrimary)

                        Text("Link your bank account securely with Plaid")
                            .font(.caption)
                            .foregroundColor(.siftTextSecondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .foregroundColor(.siftTextSecondary)
                }
                .padding(16)
                .background(Color.siftSurface)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.siftBorder, lineWidth: 1)
                )
            }

            // Upload CSV Card
            Button {
                selectedMode = .csv
            } label: {
                HStack(spacing: 16) {
                    Image(systemName: "doc.text.fill")
                        .font(.title2)
                        .foregroundColor(.siftPositive)
                        .frame(width: 44, height: 44)
                        .background(Color.siftPositive.opacity(0.15))
                        .cornerRadius(10)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Upload CSV")
                            .font(.headline)
                            .foregroundColor(.siftTextPrimary)

                        Text("Paste or upload a CSV file of transactions")
                            .font(.caption)
                            .foregroundColor(.siftTextSecondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .foregroundColor(.siftTextSecondary)
                }
                .padding(16)
                .background(Color.siftSurface)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.siftBorder, lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Plaid Flow

    private var plaidFlow: some View {
        VStack(spacing: 16) {
            backButton

            VStack(spacing: 12) {
                Image(systemName: "building.columns.fill")
                    .font(.system(size: 40))
                    .foregroundColor(.siftAccent)

                Text("Plaid Connection")
                    .font(.headline)
                    .foregroundColor(.siftTextPrimary)

                Text("Plaid integration requires native SDK setup. For now, use CSV import to get started.")
                    .font(.subheadline)
                    .foregroundColor(.siftTextSecondary)
                    .multilineTextAlignment(.center)

                Button {
                    selectedMode = .csv
                } label: {
                    Text("Switch to CSV Import")
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Color.siftAccent)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }
            }
            .padding(20)
            .background(Color.siftSurface)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.siftBorder, lineWidth: 1)
            )
        }
    }

    // MARK: - CSV Flow

    private var csvFlow: some View {
        VStack(spacing: 16) {
            backButton

            // Account Name
            VStack(alignment: .leading, spacing: 6) {
                Text("Account Name")
                    .font(.caption)
                    .foregroundColor(.siftTextSecondary)

                TextField("", text: $accountName, prompt: Text("e.g. Chase Checking").foregroundColor(.siftTextSecondary.opacity(0.5)))
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color.siftSurface)
                    .foregroundColor(.siftTextPrimary)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.siftBorder, lineWidth: 1)
                    )
            }

            // Account Type Picker
            VStack(alignment: .leading, spacing: 6) {
                Text("Account Type")
                    .font(.caption)
                    .foregroundColor(.siftTextSecondary)

                Picker("Account Type", selection: $accountType) {
                    ForEach(accountTypes, id: \.self) { type in
                        Text(type.capitalized)
                            .tag(type)
                    }
                }
                .pickerStyle(.segmented)
                .tint(.siftAccent)
            }

            // CSV Data
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("CSV Data")
                        .font(.caption)
                        .foregroundColor(.siftTextSecondary)

                    Spacer()

                    Text("\(csvData.components(separatedBy: "\n").count) lines")
                        .font(.caption2)
                        .foregroundColor(.siftTextSecondary)
                }

                TextEditor(text: $csvData)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.siftTextPrimary)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 200, maxHeight: 400)
                    .padding(8)
                    .background(Color.siftSurface)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.siftBorder, lineWidth: 1)
                    )

                Text("Paste your CSV data with headers. Expected columns: date, description, amount (or debit/credit).")
                    .font(.caption2)
                    .foregroundColor(.siftTextSecondary)
            }

            // Import Button
            Button {
                Task {
                    await importCSV()
                }
            } label: {
                HStack(spacing: 8) {
                    if isImporting {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "square.and.arrow.down")
                    }
                    Text(isImporting ? "Importing..." : "Import CSV")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Color.siftAccent)
                .foregroundColor(.white)
                .cornerRadius(10)
            }
            .disabled(accountName.isEmpty || csvData.isEmpty || isImporting)
            .opacity(accountName.isEmpty || csvData.isEmpty ? 0.6 : 1.0)
        }
    }

    // MARK: - Back Button

    private var backButton: some View {
        HStack {
            Button {
                withAnimation {
                    selectedMode = nil
                    importResult = nil
                    importError = nil
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                    Text("Back")
                }
                .font(.subheadline)
                .foregroundColor(.siftAccent)
            }
            Spacer()
        }
    }

    // MARK: - Result Card

    private func resultCard(_ result: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 40))
                .foregroundColor(.siftPositive)

            Text("Import Successful")
                .font(.headline)
                .foregroundColor(.siftTextPrimary)

            Text(result)
                .font(.subheadline)
                .foregroundColor(.siftTextSecondary)
                .multilineTextAlignment(.center)

            Button {
                showReview = true
            } label: {
                Text("Review Transactions")
                    .fontWeight(.medium)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(Color.siftAccent)
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }
        }
        .padding(20)
        .background(Color.siftSurface)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.siftPositive.opacity(0.5), lineWidth: 1)
        )
    }

    // MARK: - Import CSV

    private func importCSV() async {
        isImporting = true
        importError = nil
        importResult = nil

        do {
            let response = try await apiClient.importCsv(
                csvData: csvData,
                accountName: accountName,
                accountType: accountType
            )
            let job = response.data
            let rowCount = job.row_count ?? 0
            importResult = "Imported \(rowCount) transactions into \(accountName)."
            csvData = ""
        } catch let error as APIError {
            importError = error.errorDescription
        } catch {
            importError = error.localizedDescription
        }

        isImporting = false
    }
}

#Preview {
    OnboardingView()
        .environmentObject(APIClient.shared)
}
