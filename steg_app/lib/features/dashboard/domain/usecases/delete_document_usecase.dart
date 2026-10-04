import '../dashboard_repository.dart';

class DeleteDocumentUseCase {
  DeleteDocumentUseCase(this._repository);

  final DashboardRepository _repository;

  Future<void> call(String id) => _repository.deleteDocument(id);
}
