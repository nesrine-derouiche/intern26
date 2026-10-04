import 'app_notification.dart';
import 'document_item.dart';
import 'internship.dart';
import 'reunion.dart';
import 'supervisor_info.dart';
import '../core/utils/json_utils.dart';

class DepartmentInfo {
  const DepartmentInfo({
    required this.id,
    required this.nom,
    required this.nbEncadrants,
    required this.nbStagesActifs,
  });

  factory DepartmentInfo.fromJson(Map<String, dynamic> json) {
    return DepartmentInfo(
      id: json['id']?.toString() ?? '',
      nom: json['nom'] as String? ?? '',
      nbEncadrants: _toInt(json['nb_encadrants']) ?? 0,
      nbStagesActifs: _toInt(json['nb_stages_actifs']) ?? 0,
    );
  }

  final String id;
  final String nom;
  final int nbEncadrants;
  final int nbStagesActifs;
}

class StageStatutEntry {
  const StageStatutEntry({required this.statut, required this.total});

  factory StageStatutEntry.fromJson(Map<String, dynamic> json) {
    return StageStatutEntry(
      statut: json['statut'] as String? ?? '',
      total: numOrNull(json['total'])?.toInt() ?? 0,
    );
  }

  final String statut;
  final int total;
}

class DashboardStats {
  const DashboardStats({
    required this.notificationsNonLues,
    required this.stagesTotal,
    required this.stagesEnCours,
    required this.stagesTermines,
    required this.tachesTotal,
    required this.tachesEnCours,
    required this.tachesTerminees,
    required this.tachesAFaire,
    required this.tachesBloquees,
    required this.tachesEnRetard,
    required this.candidaturesTotal,
    required this.candidaturesEnAttente,
    required this.candidaturesAcceptees,
    required this.recentStages,
    required this.prochainsStages,
    required this.prochainesReunions,
    required this.recentDocuments,
    required this.recentNotifications,
    required this.topEncadrants,
    required this.repartitionStatutsStages,
    required this.departements,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    List<T> parseList<T>(String key, T Function(Map<String, dynamic>) parser) {
      return (json[key] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(parser)
          .toList();
    }

    return DashboardStats(
      notificationsNonLues: numOrNull(json['notificationsNonLues'])?.toInt() ?? 0,
      stagesTotal: numOrNull(json['stagesTotal'])?.toInt() ?? 0,
      stagesEnCours: numOrNull(json['stagesEnCours'])?.toInt() ?? 0,
      stagesTermines: numOrNull(json['stagesTermines'])?.toInt() ?? 0,
      tachesTotal: numOrNull(json['tachesTotal'])?.toInt() ?? 0,
      tachesEnCours: numOrNull(json['tachesEnCours'])?.toInt() ?? 0,
      tachesTerminees: numOrNull(json['tachesTerminees'])?.toInt() ?? 0,
      tachesAFaire: numOrNull(json['tachesAFaire'])?.toInt() ?? 0,
      tachesBloquees: numOrNull(json['tachesBloquees'])?.toInt() ?? 0,
      tachesEnRetard: numOrNull(json['tachesEnRetard'])?.toInt() ?? 0,
      candidaturesTotal: numOrNull(json['candidaturesTotal'])?.toInt() ?? 0,
      candidaturesEnAttente: numOrNull(json['candidaturesEnAttente'])?.toInt() ?? 0,
      candidaturesAcceptees: numOrNull(json['candidaturesAcceptees'])?.toInt() ?? 0,
      recentStages: parseList('recentStages', Internship.fromJson),
      prochainsStages: parseList('prochainsStages', Internship.fromJson),
      prochainesReunions: parseList('prochainesReunions', Reunion.fromJson),
      recentDocuments: parseList('recentDocuments', DocumentItem.fromJson),
      recentNotifications: parseList('recentNotifications', AppNotification.fromJson),
      topEncadrants: parseList('topEncadrants', SupervisorSummary.fromJson),
      repartitionStatutsStages:
          parseList('repartitionStatutsStages', StageStatutEntry.fromJson),
      departements: parseList('departements', DepartmentInfo.fromJson),
    );
  }

  final int notificationsNonLues;
  final int stagesTotal;
  final int stagesEnCours;
  final int stagesTermines;
  final int tachesTotal;
  final int tachesEnCours;
  final int tachesTerminees;
  final int tachesAFaire;
  final int tachesBloquees;
  final int tachesEnRetard;
  final int candidaturesTotal;
  final int candidaturesEnAttente;
  final int candidaturesAcceptees;
  final List<Internship> recentStages;
  final List<Internship> prochainsStages;
  final List<Reunion> prochainesReunions;
  final List<DocumentItem> recentDocuments;
  final List<AppNotification> recentNotifications;
  final List<SupervisorSummary> topEncadrants;
  final List<StageStatutEntry> repartitionStatutsStages;
  final List<DepartmentInfo> departements;

  Internship? get internship {
    for (final stage in recentStages) {
      if (stage.isActive) return stage;
    }
    if (recentStages.isNotEmpty) return recentStages.first;
    if (prochainsStages.isNotEmpty) return prochainsStages.first;
    return null;
  }

  SupervisorSummary? get supervisor {
    if (topEncadrants.isEmpty) return null;
    return topEncadrants.first;
  }

  DepartmentInfo? departmentFor(String? nom) {
    if (nom == null || nom.isEmpty) return null;
    for (final dept in departements) {
      if (dept.nom == nom) return dept;
    }
    return null;
  }
}

int? _toInt(Object? value) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}
