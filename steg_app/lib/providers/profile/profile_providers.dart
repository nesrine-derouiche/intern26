import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/stagiaire_profile.dart';
import '../../services/stagiaire_service.dart';
import '../auth/auth_provider.dart';
import '../core/api_client_provider.dart';

final stagiaireServiceProvider = Provider<StagiaireService>(
  (ref) => StagiaireService(ref.watch(dioProvider)),
);

final profileProvider =
    AsyncNotifierProvider<ProfileNotifier, StagiaireProfile?>(
  ProfileNotifier.new,
);

class ProfileNotifier extends AsyncNotifier<StagiaireProfile?> {
  @override
  Future<StagiaireProfile?> build() async {
    final authState = await ref.watch(authProvider.future);
    final user = authState.session?.user;
    if (user == null || user.role != 'STAGIAIRE') return null;
    return ref.read(stagiaireServiceProvider).getProfile(user.id);
  }
}

class AppSettings {
  const AppSettings({
    this.pushNotifications = true,
    this.language = 'Français',
  });

  final bool pushNotifications;
  final String language;

  AppSettings copyWith({bool? pushNotifications, String? language}) {
    return AppSettings(
      pushNotifications: pushNotifications ?? this.pushNotifications,
      language: language ?? this.language,
    );
  }
}

final settingsProvider =
    NotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);

class SettingsNotifier extends Notifier<AppSettings> {
  @override
  AppSettings build() => const AppSettings();

  void togglePushNotifications() {
    state = state.copyWith(pushNotifications: !state.pushNotifications);
  }

  void setLanguage(String language) {
    state = state.copyWith(language: language);
  }
}
