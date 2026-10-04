import 'dart:typed_data';

import '../dashboard_repository.dart';

class DownloadStagePdfUseCase {
  DownloadStagePdfUseCase(this._repository);

  final DashboardRepository _repository;

  Future<Uint8List> call({required String stageId, required String kind}) {
    return _repository.downloadStagePdf(stageId: stageId, kind: kind);
  }
}
