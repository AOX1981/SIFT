// Auto-generated from /contracts/openapi.yaml — do not edit manually

import Foundation

// MARK: - API Error

/// Errors raised by `SIFTAPIClient` request methods.
enum SIFTAPIError: LocalizedError {
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

private enum HTTPMethod: String {
    case GET
    case POST
    case PUT
    case PATCH
    case DELETE
}

// MARK: - AnyEncodable Helper

private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init<T: Encodable>(_ wrapped: T) {
        _encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}

// MARK: - Empty Response Helper

private struct EmptyResponse: Codable {}

// MARK: - Notification Names

extension Notification.Name {
    static let siftAPIUnauthorized = Notification.Name("siftAPIUnauthorized")
}

// MARK: - SIFTAPIClient

/// Contract-driven API client generated from the OpenAPI spec.
///
/// Covers all paths defined in `/contracts/openapi.yaml`.
/// - Base URL is configurable (defaults to `http://localhost:4000/v1`).
/// - Bearer token authentication via the `token` property.
/// - All methods use async/await with URLSession.
@MainActor
final class SIFTAPIClient: ObservableObject {

    // MARK: - Configuration

    static let shared = SIFTAPIClient()

    /// Base URL for the SIFT V1 API. Change this to point at staging / production.
    @Published var baseURL: String = "http://localhost:4000/v1"

    /// Bearer token used in the `Authorization` header.
    /// Persisted in UserDefaults under `sift_auth_token`.
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

    // MARK: - Private

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

    /// Perform an HTTP request and decode the JSON response into `T`.
    private func request<T: Codable>(
        path: String,
        method: HTTPMethod = .GET,
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil,
        authenticated: Bool = true
    ) async throws -> T {
        guard var components = URLComponents(string: "\(baseURL)\(path)") else {
            throw SIFTAPIError.invalidURL
        }

        if let queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        guard let url = components.url else {
            throw SIFTAPIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if authenticated, let token {
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
            throw SIFTAPIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SIFTAPIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            NotificationCenter.default.post(name: .siftAPIUnauthorized, object: nil)
            throw SIFTAPIError.unauthorized
        }

        if httpResponse.statusCode == 204 {
            if let empty = EmptyResponse() as? T {
                return empty
            }
            throw SIFTAPIError.noData
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            var message = "Unknown error"
            if let errorBody = try? decoder.decode(APIErrorResponse.self, from: data) {
                message = errorBody.error.message
            } else if let bodyString = String(data: data, encoding: .utf8) {
                message = bodyString
            }
            throw SIFTAPIError.httpError(statusCode: httpResponse.statusCode, message: message)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw SIFTAPIError.decodingError(error)
        }
    }

    /// Fire-and-forget variant for 204 No Content endpoints that return `Void`.
    private func requestVoid(
        path: String,
        method: HTTPMethod = .DELETE,
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil,
        authenticated: Bool = true
    ) async throws {
        let _: EmptyResponse = try await request(
            path: path,
            method: method,
            body: body,
            queryItems: queryItems,
            authenticated: authenticated
        )
    }

    // MARK: - Auth Endpoints
    // POST /auth/register  (no auth)
    // POST /auth/login      (no auth)

    /// Register a new user.
    ///
    /// `POST /auth/register` — no authentication required.
    func register(email: String, password: String, name: String? = nil) async throws -> AuthResponse {
        struct Body: Encodable {
            let email: String
            let password: String
            let name: String?
        }
        return try await request(
            path: "/auth/register",
            method: .POST,
            body: Body(email: email, password: password, name: name),
            authenticated: false
        )
    }

    /// Log in with email and password.
    ///
    /// `POST /auth/login` — no authentication required.
    func login(email: String, password: String) async throws -> AuthResponse {
        struct Body: Encodable {
            let email: String
            let password: String
        }
        return try await request(
            path: "/auth/login",
            method: .POST,
            body: Body(email: email, password: password),
            authenticated: false
        )
    }

    // MARK: - Plaid Endpoints
    // POST /plaid/link-token
    // POST /plaid/exchange
    // POST /plaid/webhook   (no auth)

    /// Create a Plaid link token for the frontend.
    ///
    /// `POST /plaid/link-token`
    func createPlaidLinkToken() async throws -> ApiResponse<PlaidLinkToken> {
        return try await request(path: "/plaid/link-token", method: .POST)
    }

    /// Exchange a Plaid public token and begin transaction sync.
    ///
    /// `POST /plaid/exchange`
    func exchangePlaidPublicToken(publicToken: String) async throws -> ApiResponse<PlaidExchangeData> {
        struct Body: Encodable {
            let public_token: String
        }
        return try await request(
            path: "/plaid/exchange",
            method: .POST,
            body: Body(public_token: publicToken)
        )
    }

    /// Forward a Plaid webhook payload.
    ///
    /// `POST /plaid/webhook` — no authentication required.
    func sendPlaidWebhook(payload: [String: AnyCodableValue]) async throws {
        let _: EmptyResponse = try await request(
            path: "/plaid/webhook",
            method: .POST,
            body: payload,
            authenticated: false
        )
    }

    // MARK: - Import Endpoints
    // POST /import/csv      (multipart/form-data)
    // GET  /import/{jobId}

    /// Upload a CSV statement for import.
    ///
    /// `POST /import/csv` — Note: the OpenAPI spec declares multipart/form-data.
    /// This method sends the CSV content as a multipart upload.
    func importCSV(fileData: Data, fileName: String, accountName: String, accountType: String = "checking") async throws -> ApiResponse<ImportJob> {
        guard let url = URL(string: "\(baseURL)/import/csv") else {
            throw SIFTAPIError.invalidURL
        }

        let boundary = "Boundary-\(UUID().uuidString)"

        var request = URLRequest(url: url)
        request.httpMethod = HTTPMethod.POST.rawValue
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()

        // file field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: text/csv\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)

        // account_name field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"account_name\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(accountName)\r\n".data(using: .utf8)!)

        // account_type field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"account_type\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(accountType)\r\n".data(using: .utf8)!)

        // closing boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw SIFTAPIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SIFTAPIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            NotificationCenter.default.post(name: .siftAPIUnauthorized, object: nil)
            throw SIFTAPIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            var message = "Unknown error"
            if let errorBody = try? decoder.decode(APIErrorResponse.self, from: data) {
                message = errorBody.error.message
            } else if let bodyString = String(data: data, encoding: .utf8) {
                message = bodyString
            }
            throw SIFTAPIError.httpError(statusCode: httpResponse.statusCode, message: message)
        }

        do {
            return try decoder.decode(ApiResponse<ImportJob>.self, from: data)
        } catch {
            throw SIFTAPIError.decodingError(error)
        }
    }

    /// Get the status of an import job.
    ///
    /// `GET /import/{jobId}`
    func getImportJob(jobId: String) async throws -> ApiResponse<ImportJob> {
        return try await request(path: "/import/\(jobId)")
    }

    // MARK: - Account Endpoints
    // GET /accounts

    /// List all user accounts.
    ///
    /// `GET /accounts`
    func getAccounts() async throws -> ApiResponse<[Account]> {
        return try await request(path: "/accounts")
    }

    // MARK: - Transaction Endpoints
    // GET /transactions

    /// List transactions with filtering and pagination.
    ///
    /// `GET /transactions`
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
    // GET  /review
    // POST /review/corrections

    /// Get Review 20 items (low-confidence transactions needing user correction).
    ///
    /// `GET /review`
    func getReviewItems() async throws -> ApiResponse<[ReviewItem]> {
        return try await request(path: "/review")
    }

    /// Submit transaction corrections from the Review 20 queue.
    ///
    /// `POST /review/corrections`
    func submitCorrections(_ corrections: [TransactionCorrection]) async throws -> ApiResponse<CorrectionResponseData> {
        struct Body: Encodable {
            let corrections: [TransactionCorrection]
        }
        return try await request(
            path: "/review/corrections",
            method: .POST,
            body: Body(corrections: corrections)
        )
    }

    // MARK: - Recurring Endpoints
    // GET  /recurring
    // POST /recurring/{id}/confirm

    /// List detected recurring transaction groups.
    ///
    /// `GET /recurring`
    func getRecurringGroups() async throws -> ApiResponse<[RecurringGroup]> {
        return try await request(path: "/recurring")
    }

    /// Confirm or reject a recurring group, optionally setting requiredness.
    ///
    /// `POST /recurring/{id}/confirm`
    func confirmRecurringGroup(id: String, confirmed: Bool, requiredness: String? = nil) async throws -> ApiResponse<RecurringGroup> {
        struct Body: Encodable {
            let confirmed: Bool
            let requiredness: String?
        }
        return try await request(
            path: "/recurring/\(id)/confirm",
            method: .POST,
            body: Body(confirmed: confirmed, requiredness: requiredness)
        )
    }

    // MARK: - Analysis Endpoints
    // POST /analysis
    // GET  /analysis/latest
    // GET  /analysis/history

    /// Run the full analysis pipeline (normalization, classification, analytics,
    /// recommendations, archetypes, narration).
    ///
    /// `POST /analysis`
    func runAnalysis(includeNarration: Bool = true) async throws -> ApiResponse<AnalysisResult> {
        struct Body: Encodable {
            let include_narration: Bool
        }
        return try await request(
            path: "/analysis",
            method: .POST,
            body: Body(include_narration: includeNarration)
        )
    }

    /// Get the most recent analysis snapshot.
    ///
    /// `GET /analysis/latest`
    func getLatestAnalysis() async throws -> ApiResponse<AnalysisResult> {
        return try await request(path: "/analysis/latest")
    }

    /// List historical analysis snapshots with pagination.
    ///
    /// `GET /analysis/history`
    func getAnalysisHistory(page: Int = 1, perPage: Int = 10) async throws -> ApiListResponse<AnalysisResult> {
        let queryItems = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "per_page", value: "\(perPage)"),
        ]
        return try await request(path: "/analysis/history", queryItems: queryItems)
    }

    // MARK: - User Rule Endpoints
    // GET    /user/rules
    // DELETE /user/rules?id={id}

    /// List all user correction rules.
    ///
    /// `GET /user/rules`
    func getUserRules() async throws -> ApiResponse<[UserRule]> {
        return try await request(path: "/user/rules")
    }

    /// Delete a user correction rule by ID.
    ///
    /// `DELETE /user/rules?id={id}`
    func deleteUserRule(id: String) async throws {
        try await requestVoid(
            path: "/user/rules",
            method: .DELETE,
            queryItems: [URLQueryItem(name: "id", value: id)]
        )
    }

    // MARK: - User Account Endpoints
    // DELETE /user/delete

    /// Hard-delete the current user and all associated data.
    ///
    /// `DELETE /user/delete`
    func deleteUser() async throws {
        try await requestVoid(path: "/user/delete", method: .DELETE)
    }
}
