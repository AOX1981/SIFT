import SwiftUI

struct MetricCard: View {
    let label: String
    let value: String
    var valueColor: Color? = nil
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption)
                .foregroundColor(.siftTextSecondary)
                .lineLimit(1)

            Text(value)
                .font(.system(.title3, design: .monospaced))
                .fontWeight(.semibold)
                .foregroundColor(valueColor ?? .siftTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            if let subtitle {
                Text(subtitle)
                    .font(.caption2)
                    .foregroundColor(.siftTextSecondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.siftSurface)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.siftBorder, lineWidth: 1)
        )
    }
}

// MARK: - Convenience Initializers

extension MetricCard {
    static func currency(label: String, value: Double, subtitle: String? = nil) -> MetricCard {
        MetricCard(
            label: label,
            value: Formatters.currency(value),
            valueColor: value >= 0 ? .siftPositive : .siftNegative,
            subtitle: subtitle
        )
    }

    static func percentage(label: String, value: Double, subtitle: String? = nil) -> MetricCard {
        MetricCard(
            label: label,
            value: Formatters.percentage(value),
            subtitle: subtitle
        )
    }

    static func number(label: String, value: Double, subtitle: String? = nil) -> MetricCard {
        MetricCard(
            label: label,
            value: Formatters.scoreDisplay(value),
            subtitle: subtitle
        )
    }
}

#Preview {
    HStack {
        MetricCard.currency(label: "Net Cash Flow", value: -1234.56)
        MetricCard.percentage(label: "Savings Rate", value: 0.23)
    }
    .padding()
    .background(Color.siftBackground)
}
