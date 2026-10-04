import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/push/push_service.dart';
import '../../core/routing/app_router.dart';
import '../../core/routing/route_paths.dart';
import '../dashboard/dashboard_providers.dart';

class PushState {
  const PushState({this.supported = false, this.tokenRegistered = false});

  const PushState.unsupported() : this();

  final bool supported;
  final bool tokenRegistered;
}

final pushServiceProvider = Provider<PushService>(
  (ref) => PushService(ref.watch(notificationServiceProvider)),
);

final pushControllerProvider =
    AsyncNotifierProvider<PushController, PushState>(PushController.new);

class PushController extends AsyncNotifier<PushState> {
  @override
  Future<PushState> build() async => const PushState.unsupported();

  /// Initialise les notifications push une fois l'utilisateur authentifié.
  /// Inoffensif si Firebase n'est pas configuré.
  Future<void> initialize() async {
    if (state.value?.supported == true) return;

    final service = ref.read(pushServiceProvider);
    final supported = await service.initialize(
      onForegroundNotification: () {
        ref.invalidate(myNotificationsProvider);
        ref.invalidate(unreadCountProvider);
      },
      onNotificationOpened: () {
        ref.read(appRouterProvider).push(RoutePaths.mesNotifications);
      },
    );

    state = AsyncData(
      PushState(supported: supported, tokenRegistered: supported),
    );
  }
}
