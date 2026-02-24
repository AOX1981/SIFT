import Foundation

// MARK: - Category Enum

enum CategoryNorm: String, CaseIterable, Codable, Identifiable {
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

    var displayName: String {
        rawValue.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

// MARK: - Requiredness Enum

enum Requiredness: String, Codable, CaseIterable {
    case REQUIRED
    case SEMI
    case REQUIRED_DISCRETIONARY
    case DISCRETIONARY

    var displayName: String {
        switch self {
        case .REQUIRED: return "Required"
        case .SEMI: return "Semi"
        case .REQUIRED_DISCRETIONARY: return "Semi-Discretionary"
        case .DISCRETIONARY: return "Discretionary"
        }
    }
}

// MARK: - User

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let name: String?
    let created_at: String?
}

// MARK: - Auth

struct AuthData: Codable {
    let user: User
    let token: String
}

struct AuthResponse: Codable {
    let data: AuthData
}

// MARK: - Account

struct Account: Codable, Identifiable {
    let id: String
    let name: String
    let official_name: String?
    let type: String?
    let subtype: String?
    let mask: String?
    let current_balance: Double?
    let available_balance: Double?
    let iso_currency_code: String?
    let source: String?
}

// MARK: - Transaction

struct Transaction: Codable, Identifiable {
    let id: String
    let account_id: String
    let source: String?
    let posted_at: String
    let amount_signed: Double
    let currency: String?
    let description_raw: String
    let merchant_raw: String?
    let merchant_norm: String?
    let merchant_group: String?
    let category_norm: String?
    let is_transfer: Bool?
    let is_fee: Bool?
    let is_interest: Bool?
    let confidence_norm: Double?
    let needs_review: Bool?
    let is_recurring: Bool?
    let recurring_key: String?
    let requiredness: String?

    var categoryEnum: CategoryNorm? {
        guard let category_norm else { return nil }
        return CategoryNorm(rawValue: category_norm)
    }

    var formattedDate: String {
        Formatters.formatDateString(posted_at)
    }

    var isOutflow: Bool {
        amount_signed < 0
    }
}

// MARK: - Review Item

struct ReviewItem: Codable, Identifiable {
    let txn_id: String
    let description_raw: String
    let amount_signed: Double
    let posted_at: String
    let merchant_group: String?
    let category_norm: String?
    let confidence_norm: Double?
    let is_transfer: Bool
    let is_fee: Bool
    let is_interest: Bool
    let review_reason: String

    var id: String { txn_id }

    var categoryEnum: CategoryNorm? {
        guard let category_norm else { return nil }
        return CategoryNorm(rawValue: category_norm)
    }
}

// MARK: - Transaction Correction

struct TransactionCorrection: Codable {
    let txn_id: String
    var merchant_group: String?
    var category_norm: String?
    var is_transfer: Bool?
    var is_fee: Bool?
    var is_interest: Bool?
    var always_apply: Bool?
}

// MARK: - Analytics Signals

struct AnalyticsSignals: Codable {
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

// MARK: - Savings Recommendation

struct TransactionProof: Codable, Identifiable {
    let txn_id: String
    let description: String
    let amount: Double
    let date: String

    var id: String { txn_id }
}

struct SavingsRecommendation: Codable, Identifiable {
    let title: String
    let type: String
    let estimated_monthly_savings: Double
    let estimated_annual_savings: Double
    let confidence: Double
    let proof: [TransactionProof]
    let steps: [String]
    let score: Double

    var id: String { title }

    var typeBadgeColor: String {
        switch type {
        case "subscription": return "purple"
        case "fee": return "red"
        case "interest": return "orange"
        case "price_drift": return "yellow"
        case "habit_cut": return "blue"
        default: return "gray"
        }
    }
}

// MARK: - Archetype

struct Archetype: Codable, Identifiable {
    let name: String
    let label: String
    let description: String
    let triggered_by: [String]
    let signal_values: [String: Double]

    var id: String { name }
}

// MARK: - Narration

struct ArchetypeNarrative: Codable, Identifiable {
    let name: String
    let narrative: String

    var id: String { name }
}

struct ActionPlan: Codable, Identifiable {
    let title: String
    let micro_plan: String

    var id: String { title }
}

struct Narration: Codable {
    let summary: String
    let archetype_narratives: [ArchetypeNarrative]?
    let action_plans: [ActionPlan]?
    let tone: String?
}

// MARK: - Analysis Result

struct AnalysisResult: Codable {
    let signals: AnalyticsSignals?
    let archetypes: [Archetype]?
    let recommendations: [SavingsRecommendation]?
    let potential_annual_savings: Double?
    let period_start: String?
    let period_end: String?
    let narration: Narration?
}

// MARK: - Recurring Group

struct RecurringGroup: Codable, Identifiable {
    let id: String
    let merchant_group: String
    let recurring_key: String
    let cadence_days: Int
    let avg_amount: Double
    let occurrences: Int
    let last_seen_at: String?
    let is_confirmed: Bool?
    let requiredness: String?
}

// MARK: - Import Job

struct ImportJob: Codable, Identifiable {
    let id: String
    let source: String
    let status: String
    let file_name: String?
    let row_count: Int?
    let error_count: Int?
}

// MARK: - User Rule

struct UserRule: Codable, Identifiable {
    let id: String
    let rule_type: String
    let match_field: String
    let match_value: String
    let assign_field: String
    let assign_value: String
}

// MARK: - Correction Response

struct CorrectionResponse: Codable {
    let updated_count: Int
    let rules_created: Int
}

// MARK: - Plaid Link Token

struct PlaidLinkToken: Codable {
    let link_token: String
    let expiration: String?
}

// MARK: - Pagination Meta

struct PaginationMeta: Codable {
    let page: Int
    let per_page: Int
    let total: Int
}

// MARK: - API Response Wrappers

struct ApiResponse<T: Codable>: Codable {
    let data: T
}

struct ApiListResponse<T: Codable>: Codable {
    let data: [T]
    let meta: PaginationMeta?
}

// MARK: - API Error

struct ApiErrorBody: Codable {
    let error: ApiErrorDetail
}

struct ApiErrorDetail: Codable {
    let code: String
    let message: String
}
