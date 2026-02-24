import Foundation

enum Formatters {

    // MARK: - Currency

    private static let currencyFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.currencySymbol = "$"
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f
    }()

    static func currency(_ value: Double) -> String {
        currencyFormatter.string(from: NSNumber(value: value)) ?? "$0.00"
    }

    static func currencyAbs(_ value: Double) -> String {
        currency(abs(value))
    }

    // MARK: - Percentage

    private static let percentFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .percent
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = 1
        f.multiplier = 1
        return f
    }()

    static func percentage(_ value: Double) -> String {
        // If value is already 0-1 range, multiply by 100
        let displayValue = abs(value) <= 1 ? value * 100 : value
        return percentFormatter.string(from: NSNumber(value: displayValue)) ?? "0%"
    }

    // MARK: - Date

    private static let displayDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d, yyyy"
        return f
    }()

    private static let shortDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f
    }()

    private static let iso8601Full: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso8601: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let simpleDateParser: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func parseDate(_ dateString: String) -> Date? {
        if let date = iso8601Full.date(from: dateString) { return date }
        if let date = iso8601.date(from: dateString) { return date }
        if let date = simpleDateParser.date(from: dateString) { return date }
        return nil
    }

    static func formatDate(_ date: Date) -> String {
        displayDateFormatter.string(from: date)
    }

    static func formatDateShort(_ date: Date) -> String {
        shortDateFormatter.string(from: date)
    }

    static func formatDateString(_ dateString: String) -> String {
        guard let date = parseDate(dateString) else { return dateString }
        return formatDate(date)
    }

    static func formatDateStringShort(_ dateString: String) -> String {
        guard let date = parseDate(dateString) else { return dateString }
        return formatDateShort(date)
    }

    // MARK: - Compact Number

    static func compactNumber(_ value: Double) -> String {
        let absValue = abs(value)
        let sign = value < 0 ? "-" : ""
        if absValue >= 1_000_000 {
            return "\(sign)$\(String(format: "%.1fM", absValue / 1_000_000))"
        } else if absValue >= 1_000 {
            return "\(sign)$\(String(format: "%.0fK", absValue / 1_000))"
        } else {
            return "\(sign)$\(String(format: "%.0f", absValue))"
        }
    }

    // MARK: - Score / Confidence

    static func confidence(_ value: Double) -> String {
        String(format: "%.0f%%", value * 100)
    }

    static func scoreDisplay(_ value: Double) -> String {
        String(format: "%.2f", value)
    }
}
