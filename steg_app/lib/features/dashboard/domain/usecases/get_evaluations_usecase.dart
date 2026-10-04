import '../../../../models/evaluation.dart';
import '../dashboard_repository.dart';

class GetEvaluationsUseCase {
  GetEvaluationsUseCase(this._repository);

  final DashboardRepository _repository;

  Future<List<Evaluation>> call() => _repository.listEvaluations();
}
