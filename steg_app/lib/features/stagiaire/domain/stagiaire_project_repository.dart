import '../../../models/stagiaire_project.dart';

abstract interface class StagiaireProjectRepository {
  Future<StagiaireProject> getProject();
}
