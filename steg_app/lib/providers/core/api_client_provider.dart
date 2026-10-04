import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session_invalidator.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';
import '../../services/auth_service.dart';

final tokenStorageProvider = Provider<TokenStorageInterface>((ref) => TokenStorage());

final sessionInvalidatorProvider = Provider<SessionInvalidator>(
  (ref) => SessionInvalidator.instance,
);

final dioProvider = Provider<Dio>(
  (ref) => buildDio(tokenStorage: ref.watch(tokenStorageProvider)),
);

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(ref.watch(dioProvider)),
);
