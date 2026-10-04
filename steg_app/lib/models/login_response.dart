import 'user.dart';

class LoginResponse {
  const LoginResponse({
    required this.message,
    required this.token,
    required this.user,
  });

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      message: json['message'] as String? ?? '',
      token: json['token'] as String? ?? '',
      user: User.fromJson((json['user'] as Map<String, dynamic>?) ?? const {}),
    );
  }

  final String message;
  final String token;
  final User user;
}
