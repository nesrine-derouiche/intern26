import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/utils/date_utils.dart';
import 'document_item.dart';
import 'evaluation.dart';
import 'internship.dart';
import 'reunion.dart';
import 'tache.dart';

enum CalendarEventType {
  stageDebut(
    value: 'STAGE_DEBUT',
    label: 'Début du stage',
    icon: Icons.flag_outlined,
    color: AppColors.success,
  ),
  stageFin(
    value: 'STAGE_FIN',
    label: 'Fin du stage',
    icon: Icons.flag,
    color: AppColors.info,
  ),
  reunion(
    value: 'REUNION',
    label: 'Réunion',
    icon: Icons.event_outlined,
    color: AppColors.primary,
  ),
  tacheEcheance(
    value: 'TACHE_ECHEANCE',
    label: 'Échéance tâche',
    icon: Icons.task_alt_outlined,
    color: AppColors.warning,
  ),
  evaluation(
    value: 'EVALUATION',
    label: 'Évaluation',
    icon: Icons.school_outlined,
    color: AppColors.purple,
  ),
  rapportHebdo(
    value: 'RAPPORT_HEBDO',
    label: 'Rapport hebdomadaire',
    icon: Icons.description_outlined,
    color: AppColors.teal,
  ),
  pointageEntree(
    value: 'POINTAGE_ENTREE',
    label: 'Pointage — entrée',
    icon: Icons.login_outlined,
    color: AppColors.violet,
  ),
  pointageSortie(
    value: 'POINTAGE_SORTIE',
    label: 'Pointage — sortie',
    icon: Icons.logout_outlined,
    color: AppColors.teal,
  );

  const CalendarEventType({
    required this.value,
    required this.label,
    required this.icon,
    required this.color,
  });

  final String value;
  final String label;
  final IconData icon;
  final Color color;
}

class CalendarEvent {
  const CalendarEvent({
    required this.id,
    required this.type,
    required this.title,
    this.description,
    this.location,
    this.time,
    this.date,
    this.allDay = false,
  });

  final String id;
  final CalendarEventType type;
  final String title;
  final String? description;
  final String? location;
  final String? time;
  final DateTime? date;
  final bool allDay;

  DateTime? get day => date == null ? null : dateOnly(date!);

  factory CalendarEvent.fromInternshipStart(Internship internship) {
    return CalendarEvent(
      id: 'stage-debut-${internship.id}',
      type: CalendarEventType.stageDebut,
      title: 'Début du stage',
      description: internship.offreTitre,
      date: internship.dateDebut,
      allDay: true,
    );
  }

  factory CalendarEvent.fromInternshipEnd(Internship internship) {
    return CalendarEvent(
      id: 'stage-fin-${internship.id}',
      type: CalendarEventType.stageFin,
      title: 'Fin du stage',
      description: internship.offreTitre,
      date: internship.dateFin,
      allDay: true,
    );
  }

  factory CalendarEvent.fromReunion(Reunion reunion) {
    return CalendarEvent(
      id: 'reunion-${reunion.id}',
      type: CalendarEventType.reunion,
      title: reunion.sujet.isEmpty ? 'Réunion' : reunion.sujet,
      description: reunion.encadrantFullName,
      location: reunion.salle,
      time: reunion.heureLabel,
      date: reunion.date,
    );
  }

  factory CalendarEvent.fromTache(Tache tache) {
    return CalendarEvent(
      id: 'tache-${tache.id}',
      type: CalendarEventType.tacheEcheance,
      title: 'Échéance : ${tache.titre}',
      description: tache.projetTitre,
      location: tache.echeanceLabel,
      date: tache.dateFin,
      allDay: true,
    );
  }

  factory CalendarEvent.fromEvaluation(Evaluation evaluation) {
    return CalendarEvent(
      id: 'evaluation-${evaluation.id}',
      type: CalendarEventType.evaluation,
      title: 'Évaluation',
      description: 'Note finale : ${evaluation.noteLabel}/20',
      location: evaluation.encadrantFullName,
      date: evaluation.dateEvaluation,
      allDay: true,
    );
  }

  factory CalendarEvent.fromRapport(DocumentItem document) {
    return CalendarEvent(
      id: 'rapport-${document.id}',
      type: CalendarEventType.rapportHebdo,
      title: document.nom.isEmpty ? 'Rapport hebdomadaire' : document.nom,
      description: 'Rapport hebdomadaire déposé',
      date: document.dateDepot,
      allDay: true,
    );
  }
}
