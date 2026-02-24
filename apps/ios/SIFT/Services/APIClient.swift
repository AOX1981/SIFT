import Foundation
import Combine

// MARK: - API Error

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int, message: String)
    case decodingError(Error)
    case networkError(Error)
    case unauthorized
    case noData

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .httpError(let code, let message):
            return "Error \(code): \(message)"
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .unauthorized:
            return "Session expired. Please log in again."
        case .noData:
            return "No data returned"
        }
    }
}

// MARK: - HTTP Method

enum HTTPMethod: String {
    case GET
    case POST
    case PUT
    case PATCH
    case DELETE
}

// MARK: - API Client

@MainActor
final class APIClient: ObservableObject {

    static let shared = APIClient()

    @Published var baseURL: String = Bundle.main.object(forInfoDictionaryKey: "SIFTAPIBaseURL") as? String ?? "http://localhost:4000/v1"

    var token: String? {
        get { UserDefaults.standard.string(forKey: "sift_auth_token") }
        set {
            if let newValue {
                UserDefaults.standard.set(newValue, forKey: "sift_auth_token")
            } else {
                UserDefaults.standard.removeObject(forKey: "sift_auth_token")
            }
        }
    }

    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
    }

    // MARK: - Generic Request

    func request<T: Codable>(
        path: String,
        method: HTTPMethod = .GET,
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        guard var components = URLComponents(string: "\(baseURL)\(path)") else {
            throw APIError.invalidURL
        }

        if let queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            let encoder = JSONEncoder()
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            NotificationCenter.default.post(name: .siftUnauthorized, object: nil)
            throw APIError.unauthorized
        }

        if httpResponse.statusCode == 204 {
            // No content responses - return empty struct if possible
            if let empty = EmptyResponse() as? T {
                return empty
            }
            throw APIError.noData
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            var message = "Unknown error"
            if let errorBody = try? decoder.decode(ApiErrorBody.self, from: data) {
                message = errorBody.error.message
            } else if let bodyString = String(data: data, encoding: .utf8) {
                message = bodyString
            }
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: message)
        }

        do {
            let decoded = try decoder.decode(T.self, from: data)
            return decoded
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Auth Endpoints

    func register(email: String, password: String, name: String?) async throws -> AuthResponse {
        struct RegisterBody: Encodable {
            let email: String
            let password: String
            let name: String?
        }
        let body = RegisterBody(email: email, password: password, name: name)
        return try await request(path: "/auth/register", method: .POST, body: body)
    }

    func login(email: String, password: String) async throws -> AuthResponse {
        struct LoginBody: Encodable {
            let email: String
            let password: String
        }
        let body = LoginBody(email: email, password: password)
        return try await request(path: "/auth/login", method: .POST, body: body)
    }

    // MARK: - Plaid Endpoints

    func createLinkToken() async throws -> ApiResponse<PlaidLinkToken> {
        return try await request(path: "/plaid/link-token", method: .POST)
    }

    func exchangePublicToken(publicToken: String) async throws -> ApiResponse<[String: String]> {
        struct ExchangeBody: Encodable {
            let public_token: String
        }
        let body = ExchangeBody(public_token: publicToken)
        return try await request(path: "/plaid/exchange", method: .POST, body: body)
    }

    // MARK: - Import Endpoints

    func importCsv(csvData: String, accountName: String, accountType: String = "checking") async throws -> ApiResponse<ImportJob> {
        struct ImportBody: Encodable {
            let csv_data: String
            let account_name: String
            let account_type: String
        }
        let body = ImportBody(csv_data: csvData, account_name: accountName, account_type: accountType)
        return try await request(path: "/import/csv", method: .POST, body: body)
    }

    func getImportJob(jobId: String) async throws -> ApiResponse<ImportJob> {
        return try await request(path: "/import/\(jobId)")
    }

    // MARK: - Account Endpoints

    func getAccounts() async throws -> ApiResponse<[Account]> {
        return try await request(path: "/accounts")
    }

    // MARK: - Transaction Endpoints

    func getTransactions(
        page: Int = 1,
        perPage: Int = 50,
        accountId: String? = nil,
        category: String? = nil,
        dateFrom: String? = nil,
        dateTo: String? = nil,
        isRecurring: Bool? = nil,
        needsReview: Bool? = nil
    ) async throws -> ApiListResponse<Transaction> {
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "per_page", value: "\(perPage)"),
        ]
        if let accountId { queryItems.append(URLQueryItem(name: "account_id", value: accountId)) }
        if let category { queryItems.append(URLQueryItem(name: "category", value: category)) }
        if let dateFrom { queryItems.append(URLQueryItem(name: "date_from", value: dateFrom)) }
        if let dateTo { queryItems.append(URLQueryItem(name: "date_to", value: dateTo)) }
        if let isRecurring { queryItems.append(URLQueryItem(name: "is_recurring", value: "\(isRecurring)")) }
        if let needsReview { queryItems.append(URLQueryItem(name: "needs_review", value: "\(needsReview)")) }

        return try await request(path: "/transactions", queryItems: queryItems)
    }

    // MARK: - Review Endpoints

    func getReviewItems() async throws -> ApiResponse<[ReviewItem]> {
        return try await request(path: "/review")
    }

    func submitCorrections(_ corrections: [TransactionCorrection]) async throws -> ApiResponse<CorrectionResponse> {
        struct CorrectionsBody: Encodable {
            let corrections: [TransactionCorrection]
        }
        let body = CorrectionsBody(corrections: corrections)
        return try await request(path: "/review/corrections", method: .POST, body: body)
    }

    // MARK: - Recurring Endpoints

    func getRecurring() async throws -> ApiResponse<[RecurringGroup]> {
        return try await request(path: "/recurring")
    }

    func confirmRecurring(id: String, confirmed: Bool, requiredness: String? = nil) async throws -> ApiResponse<RecurringGroup> {
        struct ConfirmBody: Encodable {
            let confirmed: Bool
            let requiredness: String?
        }
        let body = ConfirmBody(confirmed: confirmed, requiredness: requiredness)
        return try await request(path: "/recurring/\(id)/confirm", method: .POST, body: body)
    }

    // MARK: - Analysis Endpoints

    func runAnalysis(includeNarration: Bool = true) async throws -> ApiResponse<AnalysisResult> {
        struct AnalysisBody: Encodable {
            let include_narration: Bool
        }
        let body = AnalysisBody(include_narration: includeNarration)
        return try await request(path: "/analysis", method: .POST, body: body)
    }

    func getLatestAnalysis() async throws -> ApiResponse<AnalysisResult> {
        return try await request(path: "/analysis/latest")
    }

    func getAnalysisHistory(page: Int = 1) async throws -> ApiListResponse<AnalysisResult> {
        let queryItems = [URLQueryItem(name: "page", value: "\(page)")]
        return try await request(path: "/analysis/history", queryItems: queryItems)
    }

    // MARK: - User Endpoints

    func getUserRules() async throws -> ApiResponse<[UserRule]> {
        return try await request(path: "/user/rules")
    }

    func deleteUserRule(id: String) async throws {
        let _: EmptyResponse = try await request(
            path: "/user/rules",
            method: .DELETE,
            queryItems: [URLQueryItem(name: "id", value: id)]
        )
    }

    func deleteAccount() async throws {
        let _: EmptyResponse = try await request(path: "/user/delete", method: .DELETE)
    }
}

// MARK: - Empty Response Helper

struct EmptyResponse: Codable {}

// MARK: - AnyEncodable Helper

struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void

    init<T: Encodable>(_ wrapped: T) {
        encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encode(encoder)
    }
}

// MARK: - Notification Name

extension Notification.Name {
    static let siftUnauthorized = Notification.Name("siftUnauthorized")
}
