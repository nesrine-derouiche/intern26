import 'dart:typed_data';

import '../dashboard_repository.dart';

class DownloadDocumentUseCase {
  DownloadDocumentUseCase(this._repository);

  final DashboardRepository _repository;

  Future<Uint8List> call({required String id, bool preview = false}) {
    return _repository.downloadDocumentBytes(id: id, preview: preview);
  }
}
