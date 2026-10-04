import '../../../../models/document_item.dart';
import '../dashboard_repository.dart';

class UploadDocumentUseCase {
  UploadDocumentUseCase(this._repository);

  final DashboardRepository _repository;

  Future<DocumentItem> call({
    required String stageId,
    required String type,
    required String filePath,
    String? fileName,
  }) {
    return _repository.uploadDocument(
      stageId: stageId,
      type: type,
      filePath: filePath,
      fileName: fileName,
    );
  }
}
