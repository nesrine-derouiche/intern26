import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';
import 'pointage.dart';
import 'reunion.dart';
import 'tache.dart';

enum PlanningEventType {
  stageStart(value: 'STAGE_START'),
  stageEnd(value: 'STAGE_END'),
  reunion(value: 'REUNION'),
  taskDeadline(value: 'TASK_DEADLINE'),
  pointageEntree(value: 'POINTAGE_ENTREE'),
  pointageSortie(value: 'POINTAGE_SORTIE');

  const PlanningEventType({required this.value});

  final String value;

  static PlanningEventType? fromValue(String? value) {
    for (final type in values) {
      if (type.value == value) return type;
    }
    return null;
  }

  static PlanningEventType parse(String? value) {
    final type = fromValue(value);
    if (type == null) {
      throw FormatException("Type d'événement de planning inconnu : '$value'");
    }
    return type;
  }
}

class PlanningEvent {
  const PlanningEvent({
    required this.id,
    required this.type,
    required this.title,
    this.date,
    this.time,
    this.status,
    this.resourceId,
    this.metadata = const {},
  });

  factory PlanningEvent.fromJson(Map<String, dynamic> json) {
    return PlanningEvent(
      id: json['id']?.toString() ?? '',
      type: PlanningEventType.parse(json['type']?.toString()),
      title: json['title'] as String? ?? '',
      date: _dateOnlyString(json['date']),
      time: json['time'] as String?,
      status: json['status'] as String?,
      resourceId: json['resource_id']?.toString(),
      metadata: _metadataMap(json['metadata']),
    );
  }

  final String id;
  final PlanningEventType type;
  final String title;
  final String? date;
  final String? time;
  final String? status;
  final String? resourceId;
  final Map<String, dynamic> metadata;

  DateTime? get dateTime => parseDate(_dateOnlyString(date));

  bool get allDay => time == null || time!.isEmpty;
}

class PlanningPeriode {
  const PlanningPeriode({this.dateDebut, this.dateFin});

  factory PlanningPeriode.fromJson(Map<String, dynamic> json) {
    return PlanningPeriode(
      dateDebut: _dateOnlyString(json['date_debut']),
      dateFin: _dateOnlyString(json['date_fin']),
    );
  }

  final String? dateDebut;
  final String? dateFin;
}

class PlanningStage {
  const PlanningStage({
    required this.id,
    this.stagiaireId,
    this.encadrantId,
    this.dateDebut,
    this.dateFin,
    this.statut,
    this.horaire,
  });

  factory PlanningStage.fromJson(Map<String, dynamic> json) {
    return PlanningStage(
      id: json['id']?.toString() ?? '',
      stagiaireId: json['stagiaire_id']?.toString(),
      encadrantId: json['encadrant_id']?.toString(),
      dateDebut: _dateOnlyString(json['date_debut']),
      dateFin: _dateOnlyString(json['date_fin']),
      statut: json['statut'] as String?,
      horaire: _singleObject(json['horaire'], Horaire.fromJson),
    );
  }

  final String id;
  final String? stagiaireId;
  final String? encadrantId;
  final String? dateDebut;
  final String? dateFin;
  final String? statut;
  final Horaire? horaire;
}

class PlanningPagination {
  const PlanningPagination({
    this.page = 1,
    this.limit = 100,
    this.total = 0,
    this.pages = 0,
  });

  factory PlanningPagination.fromJson(Map<String, dynamic> json) {
    return PlanningPagination(
      page: numOrNull(json['page'])?.toInt() ?? 1,
      limit: numOrNull(json['limit'])?.toInt() ?? 100,
      total: numOrNull(json['total'])?.toInt() ?? 0,
      pages: numOrNull(json['pages'])?.toInt() ?? 0,
    );
  }

  final int page;
  final int limit;
  final int total;
  final int pages;

  bool get hasNextPage => page < pages;
}

class Planning {
  const Planning({
    this.stageId,
    this.periode,
    this.stages = const [],
    this.horaire,
    this.evenements = const [],
    this.reunions = const [],
    this.taches = const [],
    this.pointages = const [],
    this.pagination = const PlanningPagination(),
  });

  factory Planning.fromJson(Map<String, dynamic> json) {
    return Planning(
      stageId: json['stage_id']?.toString(),
      periode: _singleObject(json['periode'], PlanningPeriode.fromJson),
      stages: _objectList(json['stages'], PlanningStage.fromJson),
      horaire: _singleObject(json['horaire'], Horaire.fromJson),
      evenements: _objectList(json['evenements'], PlanningEvent.fromJson),
      reunions: _objectList(json['reunions'], Reunion.fromJson),
      taches: _objectList(json['taches'], Tache.fromJson),
      pointages: _objectList(json['pointages'], Pointage.fromJson),
      pagination: _singleObject(json['pagination'], PlanningPagination.fromJson) ??
          const PlanningPagination(),
    );
  }

  static Planning fromEnvelope(Map<String, dynamic> json) {
    final envelope = json['planning'];
    if (envelope is! Map) {
      throw FormatException(
        "Enveloppe de planning invalide : clé 'planning' absente.",
      );
    }
    return Planning.fromJson(envelope.cast<String, dynamic>());
  }

  final String? stageId;
  final PlanningPeriode? periode;
  final List<PlanningStage> stages;
  final Horaire? horaire;
  final List<PlanningEvent> evenements;
  final List<Reunion> reunions;
  final List<Tache> taches;
  final List<Pointage> pointages;
  final PlanningPagination pagination;
}

String? _dateOnlyString(Object? value) {
  if (value == null) return null;
  final raw = value.toString();
  if (raw.isEmpty) return null;
  return raw.split('T').first;
}

Map<String, dynamic> _metadataMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, entry) => MapEntry(key.toString(), entry));
  }
  return const {};
}

List<T> _objectList<T>(
  Object? value,
  T Function(Map<String, dynamic> json) fromJson,
) {
  if (value is! List) return const [];
  return [
    for (final item in value)
      if (item is Map) fromJson(item.cast<String, dynamic>()),
  ];
}

T? _singleObject<T>(
  Object? value,
  T Function(Map<String, dynamic> json) fromJson,
) {
  if (value is! Map) return null;
  return fromJson(value.cast<String, dynamic>());
}
