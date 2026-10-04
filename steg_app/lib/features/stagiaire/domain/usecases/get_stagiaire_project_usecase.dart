import '../../../../models/stagiaire_project.dart';
import '../stagiaire_project_repository.dart';

class GetStagiaireProjectUseCase {
  GetStagiaireProjectUseCase(this._repository);

  final StagiaireProjectRepository _repository;

  Future<StagiaireProject> call() => _repository.getProject();
}
