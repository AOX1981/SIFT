import SwiftUI

@main
struct SIFTApp: App {
    @StateObject private var authManager = AuthManager()

    private let apiClient = APIClient.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticated {
                    ContentView()
                } else {
                    LoginView()
                }
            }
            .environmentObject(authManager)
            .environmentObject(apiClient)
            .preferredColorScheme(.dark)
            .onReceive(NotificationCenter.default.publisher(for: .siftUnauthorized)) { _ in
                authManager.logout()
            }
        }
    }
}
