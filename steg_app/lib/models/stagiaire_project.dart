import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

class StagiaireProject {
  const StagiaireProject({
    required this.project,
    required this.stage,
    required this.tasks,
  });

  factory StagiaireProject.fromJson(Map<String, dynamic> json) {
    final projectData = _asMap(json['project']);
    final stageData = _asMap(json['stage']);
    final tasksData = _asMap(json['tasks']);

    return StagiaireProject(
      project: projectData != null
          ? ProjectDetail.fromJson(projectData)
          : const ProjectDetail.empty(),
      stage: stageData != null
          ? ProjectStage.fromJson(stageData)
          : const ProjectStage.empty(),
      tasks: tasksData != null
          ? ProjectTaskStats.fromJson(tasksData)
          : const ProjectTaskStats.empty(),
    );
  }

  final ProjectDetail project;
  final ProjectStage stage;
  final ProjectTaskStats tasks;
}

class ProjectDetail {
  const ProjectDetail({
    required this.id,
    required this.titre,
    required this.description,
    required this.technologies,
    required this.etat,
    required this.avancement,
    this.supervisor,
    this.departement,
  });

  const ProjectDetail.empty()
      : id = '',
        titre = '',
        description = '',
        technologies = '',
        etat = '',
        avancement = 0,
        supervisor = null,
        departement = null;

  factory ProjectDetail.fromJson(Map<String, dynamic> json) {
    final supervisorData = _asMap(json['supervisor']);
    return ProjectDetail(
      id: json['id']?.toString() ?? '',
      titre: json['titre'] as String? ?? '',
      description: json['description'] as String? ?? '',
      technologies: json['technologies'] as String? ?? '',
      etat: json['etat'] as String? ?? '',
      avancement: numOrNull(json['avancement'])?.toInt() ?? 0,
      supervisor: supervisorData != null
          ? ProjectSupervisor.fromJson(supervisorData)
          : null,
      departement: json['departement'] as String?,
    );
  }

  final String id;
  final String titre;
  final String description;
  final String technologies;
  final String etat;
  final int avancement;
  final ProjectSupervisor? supervisor;
  final String? departement;
}

class ProjectSupervisor {
  const ProjectSupervisor({
    required this.id,
    required this.fullName,
  });

  factory ProjectSupervisor.fromJson(Map<String, dynamic> json) {
    return ProjectSupervisor(
      id: json['id']?.toString() ?? '',
      fullName: json['full_name'] as String? ?? '',
    );
  }

  final String id;
  final String fullName;
}

class ProjectStage {
  const ProjectStage({
    required this.id,
    this.dateDebut,
    this.dateFin,
    required this.statut,
  });

  const ProjectStage.empty()
      : id = '',
        dateDebut = null,
        dateFin = null,
        statut = '';

  factory ProjectStage.fromJson(Map<String, dynamic> json) {
    return ProjectStage(
      id: json['id']?.toString() ?? '',
      dateDebut: parseDate(json['date_debut']),
      dateFin: parseDate(json['date_fin']),
      statut: json['statut'] as String? ?? '',
    );
  }

  final String id;
  final DateTime? dateDebut;
  final DateTime? dateFin;
  final String statut;
}

class ProjectTaskStats {
  const ProjectTaskStats({
    required this.total,
    required this.todo,
    required this.inProgress,
    required this.completed,
    required this.blocked,
    required this.overdue,
  });

  const ProjectTaskStats.empty()
      : total = 0,
        todo = 0,
        inProgress = 0,
        completed = 0,
        blocked = 0,
        overdue = 0;

  factory ProjectTaskStats.fromJson(Map<String, dynamic> json) {
    return ProjectTaskStats(
      total: numOrNull(json['total'])?.toInt() ?? 0,
      todo: numOrNull(json['todo'])?.toInt() ?? 0,
      inProgress: numOrNull(json['in_progress'])?.toInt() ?? 0,
      completed: numOrNull(json['completed'])?.toInt() ?? 0,
      blocked: numOrNull(json['blocked'])?.toInt() ?? 0,
      overdue: numOrNull(json['overdue'])?.toInt() ?? 0,
    );
  }

  final int total;
  final int todo;
  final int inProgress;
  final int completed;
  final int blocked;
  final int overdue;
}

Map<String, dynamic>? _asMap(Object? value) {
  if (value == null) return null;
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.cast<String, dynamic>();
  return null;
}
