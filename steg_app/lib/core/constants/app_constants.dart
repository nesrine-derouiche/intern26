class AppConstants {
  AppConstants._();

  static const String appName = 'STEG App';
  static const String appVersion = '1.0.0';
  static const String environment =
      String.fromEnvironment('ENV', defaultValue: 'dev');
}
