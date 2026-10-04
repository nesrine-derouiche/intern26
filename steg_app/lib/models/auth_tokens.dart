class AuthTokens {
  const AuthTokens({required this.accessToken, this.refreshToken, this.expiresAt});

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    final expiresAt = json['expiresAt'];
    return AuthTokens(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String?,
      expiresAt: expiresAt is String ? DateTime.tryParse(expiresAt) : null,
    );
  }

  final String accessToken;
  final String? refreshToken;
  final DateTime? expiresAt;

  bool get isExpired => expiresAt != null && expiresAt!.isBefore(DateTime.now());

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'expiresAt': expiresAt?.toIso8601String(),
    };
  }
}
