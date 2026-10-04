import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../services/notification_service.dart';

@pragma('vm:entry-point')
Future<void> pushBackgroundMessageHandler(RemoteMessage message) async {
  // En arrière-plan, le système affiche la notification pour nous.
}

class PushService {
  PushService(this._notificationService);

  final NotificationService _notificationService;

  bool _appInitialized = false;
  bool _messagingReady = false;
  bool _localNotificationsReady = false;

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'steg_notifications',
    'Notifications STEG',
    description: 'Alertes du stage et du tableau de bord',
    importance: Importance.high,
  );

  bool get isReady => _messagingReady;

  /// Initialise Firebase Messaging et les notifications locales.
  ///
  /// Retourne `false` (sans jamais lever d'exception) lorsque Firebase n'est
  /// pas encore configuré sur l'appareil (fichiers de config manquants ou
  /// environnement de test), ce qui laisse l'application parfaitement
  /// fonctionnelle sans push.
  Future<bool> initialize({
    required VoidCallback onForegroundNotification,
    required VoidCallback onNotificationOpened,
  }) async {
    if (_messagingReady) return true;

    try {
      if (!_appInitialized) {
        await Firebase.initializeApp();
        _appInitialized = true;
      }
    } catch (error) {
      debugPrint('FCM non configuré : $error');
      return false;
    }

    try {
      FirebaseMessaging.onBackgroundMessage(pushBackgroundMessageHandler);
      final messaging = FirebaseMessaging.instance;

      await messaging.requestPermission(alert: true, badge: true, sound: true);

      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        await _registerToken(token);
      }

      messaging.onTokenRefresh.listen((newToken) => _registerToken(newToken));

      FirebaseMessaging.onMessage.listen((message) {
        _showLocalNotification(message);
        onForegroundNotification();
      });

      FirebaseMessaging.onMessageOpenedApp.listen((message) {
        _showLocalNotification(message);
        onNotificationOpened();
      });

      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        onNotificationOpened();
      }

      await _initLocalNotifications();
      _messagingReady = true;
      return true;
    } catch (error) {
      debugPrint('Échec de l\'initialisation FCM : $error');
      return false;
    }
  }

  Future<void> _registerToken(String token) async {
    try {
      await _notificationService.registerDeviceToken(token);
    } catch (error) {
      debugPrint('Enregistrement du jeton push impossible : $error');
    }
  }

  Future<void> _initLocalNotifications() async {
    try {
      await _localNotifications.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(
            requestAlertPermission: false,
            requestBadgePermission: false,
            requestSoundPermission: false,
          ),
        ),
      );
      _localNotificationsReady = true;
      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);
    } catch (error) {
      debugPrint('Notifications locales indisponibles : $error');
    }
  }

  Future<void> _showLocalNotification(RemoteMessage message) async {
    if (!_localNotificationsReady) return;
    try {
      await _localNotifications.show(
        id: message.messageId?.hashCode ?? 0,
        title: message.notification?.title ?? 'Nouvelle notification',
        body: message.notification?.body ?? message.data['body'],
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            _channel.id,
            _channel.name,
            channelDescription: _channel.description,
            icon: '@mipmap/ic_launcher',
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        payload: message.data['type'],
      );
    } catch (error) {
      debugPrint('Affichage de la notification impossible : $error');
    }
  }
}
