import '../../../models/stagiaire_project.dart';
import '../../../services/stagiaire_project_service.dart';
import '../domain/stagiaire_project_repository.dart';

class StagiaireProjectRepositoryImpl implements StagiaireProjectRepository {
  StagiaireProjectRepositoryImpl(this._service);

  final StagiaireProjectService _service;

  @override
  Future<StagiaireProject> getProject() => _service.getProject();
}
