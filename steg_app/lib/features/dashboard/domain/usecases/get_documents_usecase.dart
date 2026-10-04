import '../../../../models/document_item.dart';
import '../dashboard_repository.dart';

class GetDocumentsUseCase {
  GetDocumentsUseCase(this._repository);

  final DashboardRepository _repository;

  Future<List<DocumentItem>> call({required String stageId}) {
    return _repository.listDocuments(stageId: stageId);
  }
}
