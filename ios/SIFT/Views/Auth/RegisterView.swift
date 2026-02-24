import SwiftUI

struct RegisterView: View {
    @EnvironmentObject private var authManager: AuthManager
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        ZStack {
            Color.siftBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 32) {
                    Spacer()
                        .frame(height: 40)

                    // Header
                    VStack(spacing: 8) {
                        Text("SIFT")
                            .font(.system(size: 48, weight: .bold, design: .monospaced))
                            .foregroundColor(.siftAccent)

                        Text("Create your account")
                            .font(.subheadline)
                            .foregroundColor(.siftTextSecondary)
                    }

                    Spacer()
                        .frame(height: 20)

                    // Form
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Name (optional)")
                                .font(.caption)
                                .foregroundColor(.siftTextSecondary)

                            TextField("", text: $name)
                                .textFieldStyle(.plain)
                                .textContentType(.name)
                                .textInputAutocapitalization(.words)
                                .padding(12)
                                .background(Color.siftSurface)
                                .foregroundColor(.siftTextPrimary)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.siftBorder, lineWidth: 1)
                                )
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Email")
                                .font(.caption)
                                .foregroundColor(.siftTextSecondary)

                            TextField("", text: $email)
                                .textFieldStyle(.plain)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding(12)
                                .background(Color.siftSurface)
                                .foregroundColor(.siftTextPrimary)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.siftBorder, lineWidth: 1)
                                )
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Password")
                                .font(.caption)
                                .foregroundColor(.siftTextSecondary)

                            SecureField("", text: $password)
                                .textFieldStyle(.plain)
                                .textContentType(.newPassword)
                                .padding(12)
                                .background(Color.siftSurface)
                                .foregroundColor(.siftTextPrimary)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.siftBorder, lineWidth: 1)
                                )

                            Text("Minimum 8 characters")
                                .font(.caption2)
                                .foregroundColor(.siftTextSecondary)
                        }
                    }

                    // Error message
                    if let error = authManager.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.siftNegative)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    // Register button
                    Button {
                        Task {
                            await authManager.register(
                                email: email,
                                password: password,
                                name: name.isEmpty ? nil : name
                            )
                        }
                    } label: {
                        Group {
                            if authManager.isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Create Account")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.siftAccent)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    }
                    .disabled(email.isEmpty || password.count < 8 || authManager.isLoading)
                    .opacity(email.isEmpty || password.count < 8 ? 0.6 : 1.0)

                    // Back to login
                    Button {
                        dismiss()
                    } label: {
                        HStack(spacing: 4) {
                            Text("Already have an account?")
                                .foregroundColor(.siftTextSecondary)
                            Text("Sign in")
                                .foregroundColor(.siftAccent)
                                .fontWeight(.medium)
                        }
                        .font(.subheadline)
                    }

                    Spacer()
                }
                .padding(.horizontal, 24)
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "chevron.left")
                        .foregroundColor(.siftTextSecondary)
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        RegisterView()
            .environmentObject(AuthManager())
    }
}
