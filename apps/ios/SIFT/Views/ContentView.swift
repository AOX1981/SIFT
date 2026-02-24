import SwiftUI
import UIKit

struct ContentView: View {
    @EnvironmentObject private var authManager: AuthManager
    @EnvironmentObject private var apiClient: APIClient

    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar.fill")
                }
                .tag(0)

            TransactionsView()
                .tabItem {
                    Label("Transactions", systemImage: "list.bullet.rectangle.fill")
                }
                .tag(1)

            ReviewView()
                .tabItem {
                    Label("Review", systemImage: "checkmark.circle.fill")
                }
                .tag(2)

            OnboardingView()
                .tabItem {
                    Label("Import", systemImage: "square.and.arrow.down.fill")
                }
                .tag(3)
        }
        .tint(.siftAccent)
        .onAppear {
            configureTabBarAppearance()
        }
    }

    private func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Color.siftBackground)

        appearance.stackedLayoutAppearance.normal.iconColor = UIColor(Color.siftTextSecondary)
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(Color.siftTextSecondary)
        ]
        appearance.stackedLayoutAppearance.selected.iconColor = UIColor(Color.siftAccent)
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(Color.siftAccent)
        ]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthManager())
        .environmentObject(APIClient.shared)
}
