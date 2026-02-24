// Auto-generated from /contracts/openapi.yaml — do not edit manually

import Foundation

// MARK: - CategoryNorm Enum

/// Normalized spending categories.
/// OpenAPI enum: HOUSING, UTILITIES, INSURANCE, GROCERIES, DINING, TRANSPORT, GAS,
/// HEALTHCARE, PERSONAL_CARE, SHOPPING, ENTERTAINMENT, TRAVEL, EDUCATION,
/// SUBSCRIPTIONS, FEES, INTEREST, DEBT_PAYMENT, INCOME, TRANSFER, INVESTMENT,
/// CHARITY, CHILDCARE, PETS, OTHER
enum CategoryNorm: String, Codable, CaseIterable, Identifiable, Sendable {
    case HOUSING
    case UTILITIES
    case INSURANCE
    case GROCERIES
    case DINING
    case TRANSPORT
    case GAS
    case HEALTHCARE
    case PERSONAL_CARE
    case SHOPPING
    case ENTERTAINMENT
    case TRAVEL
    case EDUCATION
    case SUBSCRIPTIONS
    case FEES
    case INTEREST
    case DEBT_PAYMENT
    case INCOME
    case TRANSFER
    case INVESTMENT
    case CHARITY
    case CHILDCARE
    case PETS
    case OTHER

    var id: String { rawValue }
}

// MARK: - Requiredness Enum

/// Transaction requiredness classification.
/// OpenAPI enum: REQUIRED, SEMI, REQUIRED_DISCRETIONARY, DISCRETIONARY
enum Requiredness: String, Codable, CaseIterable, Sendable {
    case REQUIRED
    case SEMI
    case REQUIRED_DISCRETIONARY
    case DISCRETIONARY
}

// MARK: - Account Source Enum

/// Account data source.
/// OpenAPI enum: plaid, csv, pdf
enum AccountSource: String, Codable, Sendable {
    case plaid
    case csv
    case pdf
}

// MARK: - Transaction Source Enum

/// Transaction data source.
/// OpenAPI enum: BANK, CARD, STATEMENT
enum TransactionSource: String, Codable, Sendable {
    case BANK
    case CARD
    case STATEMENT
}

// MARK: - Import Source Enum

/// Import job source.
/// OpenAPI enum: PLAID, CSV, PDF
enum ImportSource: String, Codable, Sendable {
    case PLAID
    case CSV
    case PDF
}

// MARK: - Import Status Enum

/// Import job status.
/// OpenAPI enum: PENDING, PROCESSING, COMPLETED, FAILED
enum ImportStatus: String, Codable, Sendable {
    case PENDING
    case PROCESSING
    case COMPLETED
    case FAILED
}

// MARK: - Archetype Name Enum

/// Behavioral archetype identifiers.
/// OpenAPI enum for Archetype.name
enum ArchetypeName: String, Codable, CaseIterable, Sendable {
    case PAYDAY_SPIKER
    case WEEKEND_LEAKER
    case SUBSCRIPTION_CREEP
    case CONVENIENCE_EATER
    case IMPULSE_MICRO_SPENDER
    case LIFESTYLE_CREEP
    case BILL_DRIFT_VICTIM
    case FEE_PAYER
    case INTEREST_LEAKER
    case VOLATILITY_STRESSOR
}

// MARK: - Savings Recommendation Type Enum

/// Type of savings recommendation.
/// OpenAPI enum: subscription, fee, interest, price_drift, habit_cut
enum SavingsRecommendationType: String, Codable, Sendable {
    case subscription
    case fee
    case interest
    case price_drift
    case habit_cut
}

// MARK: - Error

/// OpenAPI schema: Error
struct APIErrorResponse: Codable, Sendable {
    let error: APIErrorDetail
}

struct APIErrorDetail: Codable, Sendable {
    let code: String
    let message: String
    let details: [String: AnyCodableValue]?
}

// MARK: - PaginationMeta

/// OpenAPI schema: PaginationMeta
struct PaginationMeta: Codable, Sendable {
    let page: Int?
    let per_page: Int?
    let total: Int?
}

// MARK: - User

/// OpenAPI schema: User
/// Required: id, email
struct User: Codable, Identifiable, Sendable {
    let id: String
    let email: String
    let name: String?
    let created_at: String?
}

// MARK: - Account

/// OpenAPI schema: Account
/// Required: id, name, type, source
struct Account: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let official_name: String?
    let type: String
    let subtype: String?
    let mask: String?
    let current_balance: Double?
    let available_balance: Double?
    let iso_currency_code: String?
    let source: AccountSource
}

// MARK: - Transaction

/// OpenAPI schema: Transaction
/// Required: id, account_id, posted_at, amount_signed, description_raw
struct Transaction: Codable, Identifiable, Sendable {
    let id: String
    let account_id: String
    let source: TransactionSource?
    let posted_at: String
    /// Outflow negative
    let amount_signed: Double
    let currency: String?
    let description_raw: String
    let merchant_raw: String?
    let merchant_norm: String?
    let merchant_group: String?
    let category_norm: CategoryNorm?
    let is_transfer: Bool?
    let is_fee: Bool?
    let is_interest: Bool?
    let confidence_norm: Double?
    let needs_review: Bool?
    let is_recurring: Bool?
    let recurring_key: String?
    let requiredness: Requiredness?
}

// MARK: - PlaidLinkToken

/// OpenAPI schema: PlaidLinkToken
/// Required: link_token, expiration
struct PlaidLinkToken: Codable, Sendable {
    let link_token: String
    let expiration: String
}

// MARK: - ImportJob

/// OpenAPI schema: ImportJob
/// Required: id, source, status
struct ImportJob: Codable, Identifiable, Sendable {
    let id: String
    let source: ImportSource
    let status: ImportStatus
    let file_name: String?
    let row_count: Int?
    let error_count: Int?
    let errors: [[String: AnyCodableValue]]?
    let started_at: String?
    let completed_at: String?
}

// MARK: - ReviewItem

/// OpenAPI schema: ReviewItem
/// Required: txn_id, description_raw, amount_signed, posted_at, confidence_norm, review_reason
struct ReviewItem: Codable, Identifiable, Sendable {
    let txn_id: String
    let description_raw: String
    let amount_signed: Double
    let posted_at: String
    let merchant_group: String?
    let category_norm: String?
    let confidence_norm: Double
    let is_transfer: Bool?
    let is_fee: Bool?
    let is_interest: Bool?
    let review_reason: String

    var id: String { txn_id }
}

// MARK: - TransactionCorrection

/// OpenAPI schema: TransactionCorrection
/// Required: txn_id
struct TransactionCorrection: Codable, Sendable {
    let txn_id: String
    var merchant_group: String?
    var category_norm: String?
    var is_transfer: Bool?
    var is_fee: Bool?
    var is_interest: Bool?
    /// Creates a persistent user rule
    var always_apply: Bool?
}

// MARK: - AnalyticsSignals

/// OpenAPI schema: AnalyticsSignals
/// All 25 numeric signal fields plus day_of_week_map dictionary.
struct AnalyticsSignals: Codable, Sendable {
    let net_cashflow: Double?
    let fixed_vs_variable_ratio: Double?
    let required_vs_discretionary_ratio: Double?
    let discretionary_burn_rate: Double?
    let top_merchant_concentration: Double?
    let category_creep_mom: Double?
    let merchant_creep_mom: Double?
    let rolling_baseline_delta: Double?
    let seasonality_index: Double?
    let price_drift_recurring: Double?
    let day_of_week_map: [String: Double]?
    let weekend_premium: Double?
    let late_night_premium: Double?
    let payday_spike: Double?
    let impulse_frequency: Double?
    let subscription_count: Double?
    let subscription_total: Double?
    let fees_total: Double?
    let interest_total: Double?
    let duplicate_charges: Double?
    let cash_buffer_estimate: Double?
    let volatility_score: Double?
    let large_purchase_outliers: Double?
    let savings_rate_estimate: Double?
    let debt_pressure_proxy: Double?
}

// MARK: - SavingsRecommendation

/// Proof transaction referenced in a SavingsRecommendation.
struct SavingsRecommendationProof: Codable, Sendable {
    let txn_id: String?
    let description: String?
    let amount: Double?
    let date: String?
}

/// OpenAPI schema: SavingsRecommendation
/// Required: title, type, estimated_monthly_savings, estimated_annual_savings, confidence, proof, steps, score
struct SavingsRecommendation: Codable, Identifiable, Sendable {
    let title: String
    let type: SavingsRecommendationType
    let estimated_monthly_savings: Double
    let estimated_annual_savings: Double
    let confidence: Double
    let proof: [SavingsRecommendationProof]
    let steps: [String]
    let score: Double

    var id: String { title }
}

// MARK: - Archetype

/// OpenAPI schema: Archetype
/// Required: name, label, description
struct Archetype: Codable, Identifiable, Sendable {
    let name: ArchetypeName
    let label: String
    let description: String
    let triggered_by: [String]?
    let signal_values: [String: Double]?

    var id: String { name.rawValue }
}

// MARK: - AnalysisResult

/// Narration sub-object: archetype narrative.
struct ArchetypeNarrative: Codable, Sendable {
    let name: String?
    let narrative: String?
}

/// Narration sub-object: action plan.
struct ActionPlan: Codable, Sendable {
    let title: String?
    let micro_plan: String?
}

/// Narration sub-object of AnalysisResult.
struct Narration: Codable, Sendable {
    let summary: String?
    let archetype_narratives: [ArchetypeNarrative]?
    let action_plans: [ActionPlan]?
}

/// OpenAPI schema: AnalysisResult
/// Required: signals, archetypes, recommendations, potential_annual_savings, period_start, period_end
struct AnalysisResult: Codable, Sendable {
    let signals: AnalyticsSignals
    let archetypes: [Archetype]
    let recommendations: [SavingsRecommendation]
    /// Conservative with 0.85 safety haircut. Shown only if >= $1000.
    let potential_annual_savings: Double
    let period_start: String
    let period_end: String
    let narration: Narration?
}

// MARK: - RecurringGroup

/// OpenAPI schema: RecurringGroup
/// Required: id, merchant_group, recurring_key, cadence_days, avg_amount, occurrences
struct RecurringGroup: Codable, Identifiable, Sendable {
    let id: String
    let merchant_group: String
    let recurring_key: String
    let cadence_days: Int
    let avg_amount: Double
    let occurrences: Int
    let last_seen_at: String?
    let is_confirmed: Bool?
    let requiredness: Requiredness?
}

// MARK: - UserRule

/// Inline schema from GET /user/rules response.
struct UserRule: Codable, Identifiable, Sendable {
    let id: String?
    let rule_type: String?
    let match_field: String?
    let match_value: String?
    let assign_field: String?
    let assign_value: String?
}

// MARK: - API Response Wrappers

/// Generic single-object API response: `{ "data": T }`.
struct ApiResponse<T: Codable>: Codable {
    let data: T
}

/// Generic list API response with optional pagination: `{ "data": [T], "meta": ... }`.
struct ApiListResponse<T: Codable>: Codable {
    let data: [T]
    let meta: PaginationMeta?
}

// MARK: - Auth Response Types

/// Auth endpoint data payload: `{ "user": User, "token": "..." }`.
struct AuthData: Codable, Sendable {
    let user: User
    let token: String
}

/// Auth endpoint full response: `{ "data": { "user": ..., "token": ... } }`.
struct AuthResponse: Codable, Sendable {
    let data: AuthData
}

// MARK: - Plaid Exchange Response

/// Response data from POST /plaid/exchange.
struct PlaidExchangeData: Codable, Sendable {
    let connection_id: String?
    let accounts: [Account]?
    let import_job_id: String?
}

// MARK: - Correction Response

/// Response data from POST /review/corrections.
struct CorrectionResponseData: Codable, Sendable {
    let updated_count: Int?
    let rules_created: Int?
}

// MARK: - AnyCodableValue

/// A type-erased Codable value for representing `additionalProperties` / untyped objects.
enum AnyCodableValue: Codable, Sendable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int.self) {
            self = .int(value)
        } else if let value = try? container.decode(Double.self) {
            self = .double(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if container.decodeNil() {
            self = .null
        } else {
            throw DecodingError.typeMismatch(
                AnyCodableValue.self,
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Unsupported type")
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .double(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}
