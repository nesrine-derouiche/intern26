import '../core/utils/date_utils.dart';
import 'internship.dart';
import '../core/utils/json_utils.dart';

class StagiaireOverview {
  const StagiaireOverview({
    this.trainee,
    this.internship,
    this.project,
    required this.tasks,
    required this.upcomingMeetings,
    this.journal,
    this.evaluation,
  });

  factory StagiaireOverview.fromJson(Map<String, dynamic> json) {
    final traineeData = _asMap(json['trainee']);
    final internshipData = _asMap(json['internship']);
    final projectData = _asMap(json['project']);
    final tasksData = _asMap(json['tasks']) ?? <String, dynamic>{};
    final meetingsRaw = json['upcoming_meetings'] as List<dynamic>?;
    final journalData = _asMap(json['journal']);
    final evaluationData = _asMap(json['evaluation']);

    return StagiaireOverview(
      trainee: traineeData != null ? OverviewTrainee.fromJson(traineeData) : null,
      internship: internshipData != null
          ? OverviewInternship.fromJson(internshipData)
          : null,
      project: projectData != null ? OverviewProject.fromJson(projectData) : null,
      tasks: OverviewTaskStats.fromJson(tasksData),
      upcomingMeetings: (meetingsRaw ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(OverviewMeeting.fromJson)
          .toList(),
      journal: journalData != null
          ? OverviewJournalStats.fromJson(journalData)
          : null,
      evaluation: evaluationData != null
          ? OverviewEvaluation.fromJson(evaluationData)
          : null,
    );
  }

  final OverviewTrainee? trainee;
  final OverviewInternship? internship;
  final OverviewProject? project;
  final OverviewTaskStats tasks;
  final List<OverviewMeeting> upcomingMeetings;
  final OverviewJournalStats? journal;
  final OverviewEvaluation? evaluation;

  bool get hasStage => internship != null;

  Internship? get asInternship {
    final i = internship;
    if (i == null) return null;
    return Internship(
      id: i.id,
      dateDebut: i.startDate,
      dateFin: i.endDate,
      statut: i.status,
      stagiaireNom: trainee?.nom ?? '',
      stagiairePrenom: trainee?.prenom ?? '',
      encadrantNom: i.supervisor?.fullName ?? '',
      encadrantPrenom: '',
      departementNom: '',
      offreTitre: i.title,
    );
  }
}

class OverviewTrainee {
  const OverviewTrainee({
    required this.id,
    required this.nom,
    required this.prenom,
    required this.email,
  });

  factory OverviewTrainee.fromJson(Map<String, dynamic> json) {
    return OverviewTrainee(
      id: json['id']?.toString() ?? '',
      nom: json['nom'] as String? ?? '',
      prenom: json['prenom'] as String? ?? '',
      email: json['email'] as String? ?? '',
    );
  }

  final String id;
  final String nom;
  final String prenom;
  final String email;

  String get fullName => '$prenom $nom'.trim();
}

class OverviewInternship {
  const OverviewInternship({
    required this.id,
    required this.title,
    this.startDate,
    this.endDate,
    required this.status,
    this.supervisor,
  });

  factory OverviewInternship.fromJson(Map<String, dynamic> json) {
    final supervisorData = json['supervisor'] as Map<String, dynamic>?;
    return OverviewInternship(
      id: json['id']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      startDate: parseDate(json['start_date']),
      endDate: parseDate(json['end_date']),
      status: json['status'] as String? ?? '',
      supervisor: supervisorData != null
          ? OverviewSupervisor.fromJson(supervisorData)
          : null,
    );
  }

  final String id;
  final String title;
  final DateTime? startDate;
  final DateTime? endDate;
  final String status;
  final OverviewSupervisor? supervisor;

  int get progress {
    if (status == 'TERMINE') return 100;
    final start = startDate;
    final end = endDate;
    if (start == null || end == null) return 0;
    final total = end.difference(start).inDays;
    if (total <= 0) return 0;
    final elapsed = dateOnly(DateTime.now()).difference(dateOnly(start)).inDays;
    return (elapsed / total * 100).clamp(0, 100).round();
  }
}

class OverviewSupervisor {
  const OverviewSupervisor({required this.id, required this.fullName});

  factory OverviewSupervisor.fromJson(Map<String, dynamic> json) {
    return OverviewSupervisor(
      id: json['id']?.toString() ?? '',
      fullName: json['full_name'] as String? ?? '',
    );
  }

  final String id;
  final String fullName;
}

class OverviewProject {
  const OverviewProject({
    required this.id,
    required this.titre,
    required this.description,
    required this.avancement,
  });

  factory OverviewProject.fromJson(Map<String, dynamic> json) {
    return OverviewProject(
      id: json['id']?.toString() ?? '',
      titre: json['titre'] as String? ?? '',
      description: json['description'] as String? ?? '',
      avancement: numOrNull(json['avancement'])?.toInt() ?? 0,
    );
  }

  final String id;
  final String titre;
  final String description;
  final int avancement;
}

class OverviewTaskStats {
  const OverviewTaskStats({
    required this.total,
    required this.todo,
    required this.inProgress,
    required this.completed,
    required this.overdue,
    required this.next,
  });

  factory OverviewTaskStats.fromJson(Map<String, dynamic> json) {
    final nextRaw = json['next'] as List<dynamic>?;
    return OverviewTaskStats(
      total: numOrNull(json['total'])?.toInt() ?? 0,
      todo: numOrNull(json['todo'])?.toInt() ?? 0,
      inProgress: numOrNull(json['in_progress'])?.toInt() ?? 0,
      completed: numOrNull(json['completed'])?.toInt() ?? 0,
      overdue: numOrNull(json['overdue'])?.toInt() ?? 0,
      next: (nextRaw ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(OverviewTask.fromJson)
          .toList(),
    );
  }

  final int total;
  final int todo;
  final int inProgress;
  final int completed;
  final int overdue;
  final List<OverviewTask> next;
}

class OverviewTask {
  const OverviewTask({
    required this.id,
    required this.titre,
    required this.priorite,
    this.dateFin,
    required this.statut,
  });

  factory OverviewTask.fromJson(Map<String, dynamic> json) {
    return OverviewTask(
      id: json['id']?.toString() ?? '',
      titre: json['titre'] as String? ?? '',
      priorite: json['priorite'] as String? ?? 'MOYENNE',
      dateFin: parseDate(json['date_fin']),
      statut: json['statut'] as String? ?? 'A_FAIRE',
    );
  }

  final String id;
  final String titre;
  final String priorite;
  final DateTime? dateFin;
  final String statut;
}

class OverviewMeeting {
  const OverviewMeeting({
    required this.id,
    this.date,
    required this.heure,
    required this.sujet,
    this.salle,
    this.lienVisio,
  });

  factory OverviewMeeting.fromJson(Map<String, dynamic> json) {
    return OverviewMeeting(
      id: json['id']?.toString() ?? '',
      date: parseDate(json['date']),
      heure: json['heure'] as String? ?? '',
      sujet: json['sujet'] as String? ?? '',
      salle: json['salle'] as String?,
      lienVisio: json['lien_visio'] as String?,
    );
  }

  final String id;
  final DateTime? date;
  final String heure;
  final String sujet;
  final String? salle;
  final String? lienVisio;

  String get heureLabel => formatTimeFr(heure);
}

class OverviewJournalStats {
  const OverviewJournalStats({
    required this.total,
    required this.submitted,
    required this.pending,
  });

  factory OverviewJournalStats.fromJson(Map<String, dynamic> json) {
    return OverviewJournalStats(
      total: numOrNull(json['total'])?.toInt() ?? 0,
      submitted: numOrNull(json['submitted'])?.toInt() ?? 0,
      pending: numOrNull(json['pending'])?.toInt() ?? 0,
    );
  }

  final int total;
  final int submitted;
  final int pending;
}

class OverviewEvaluation {
  const OverviewEvaluation({
    required this.id,
    this.noteFinale,
    required this.validee,
  });

  factory OverviewEvaluation.fromJson(Map<String, dynamic> json) {
    return OverviewEvaluation(
      id: json['id']?.toString() ?? '',
      noteFinale: numOrNull(json['note_finale'])?.toDouble(),
      validee: json['validee'] as bool? ?? false,
    );
  }

  final String id;
  final double? noteFinale;
  final bool validee;
}

Map<String, dynamic>? _asMap(Object? value) {
  if (value == null) return null;
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.cast<String, dynamic>();
  return null;
}
