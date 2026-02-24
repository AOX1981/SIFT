import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var authManager: AuthManager

    @State private var email = ""
    @State private var password = ""
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.siftBackground
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 32) {
                        Spacer()
                            .frame(height: 60)

                        // Logo
                        VStack(spacing: 8) {
                            Text("SIFT")
                                .font(.system(size: 48, weight: .bold, design: .monospaced))
                                .foregroundColor(.siftAccent)

                            Text("Spending Behavioral Analysis")
                                .font(.subheadline)
                                .foregroundColor(.siftTextSecondary)
                        }

                        Spacer()
                            .frame(height: 20)

                        // Form
                        VStack(spacing: 16) {
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
                                    .textContentType(.password)
                                    .padding(12)
                                    .background(Color.siftSurface)
                                    .foregroundColor(.siftTextPrimary)
                                    .cornerRadius(8)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.siftBorder, lineWidth: 1)
                                    )
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

                        // Sign in button
                        Button {
                            Task {
                                await authManager.login(email: email, password: password)
                            }
                        } label: {
                            Group {
                                if authManager.isLoading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Sign In")
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(Color.siftAccent)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                        }
                        .disabled(email.isEmpty || password.isEmpty || authManager.isLoading)
                        .opacity(email.isEmpty || password.isEmpty ? 0.6 : 1.0)

                        // Register link
                        Button {
                            showRegister = true
                        } label: {
                            HStack(spacing: 4) {
                                Text("Don't have an account?")
                                    .foregroundColor(.siftTextSecondary)
                                Text("Sign up")
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
            .navigationDestination(isPresented: $showRegister) {
                RegisterView()
            }
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthManager())
}
