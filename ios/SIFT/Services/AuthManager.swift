import Foundation
import SwiftUI

@MainActor
final class AuthManager: ObservableObject {

    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
        // Check if token exists on init
        if apiClient.token != nil {
            isAuthenticated = true
        }
    }

    // MARK: - Login

    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await apiClient.login(email: email, password: password)
            apiClient.token = response.data.token
            currentUser = response.data.user
            isAuthenticated = true
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Register

    func register(email: String, password: String, name: String?) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await apiClient.register(email: email, password: password, name: name)
            apiClient.token = response.data.token
            currentUser = response.data.user
            isAuthenticated = true
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Logout

    func logout() {
        apiClient.token = nil
        currentUser = nil
        isAuthenticated = false
        errorMessage = nil
    }
}
