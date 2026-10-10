import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/certification.dart';
import '../../services/certification_service.dart';
import '../core/api_client_provider.dart';

final certificationServiceProvider = Provider<CertificationService>(
  (ref) => CertificationService(ref.watch(dioProvider)),
);

final certificationProvider =
    FutureProvider.family<CertificationState?, String>((ref, stageId) async {
  final service = ref.watch(certificationServiceProvider);
  return service.getState(stageId: stageId);
});
