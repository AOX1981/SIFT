import SwiftUI

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - App Color Palette

extension Color {
    static let siftBackground = Color(hex: "#0f1117")
    static let siftSurface = Color(hex: "#1a1d27")
    static let siftBorder = Color(hex: "#2a2d3a")
    static let siftAccent = Color(hex: "#6366f1")
    static let siftTextPrimary = Color.white
    static let siftTextSecondary = Color(hex: "#9ca3af")
    static let siftPositive = Color(hex: "#22c55e")
    static let siftNegative = Color(hex: "#ef4444")
    static let siftWarning = Color(hex: "#f59e0b")
}
