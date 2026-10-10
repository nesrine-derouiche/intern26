import 'date_utils.dart';

/// Éligibilité à la certification de fin de stage.
///
/// Convention de dates (documentée) :
/// - comparaisons en **date locale** (heure normalisée à minuit via
///   [dateOnly]) : les bornes de fuseau horaire ne peuvent ni avancer ni
///   retarder l'éligibilité d'un jour entier par erreur d'heure ;
/// - semaine finale **inclusive des deux bornes** : [endDate - 6 jours,
///   endDate]. Le jour de fin fait partie de la semaine finale ;
/// - date de fin absente ou stage terminé (endDate < aujourd'hui) :
///   jamais éligible, jamais surligné.
bool isInFinalWeek(DateTime now, DateTime? endDate) {
  if (endDate == null) return false;
  final diff = dateOnly(endDate).difference(dateOnly(now)).inDays;
  return diff >= 0 && diff <= 6;
}

/// Vrai si [day] appartient à la semaine finale de [endDate]
/// (même convention inclusive que [isInFinalWeek]).
bool isFinalWeekDay(DateTime day, DateTime? endDate) {
  if (endDate == null) return false;
  final diff = dateOnly(endDate).difference(dateOnly(day)).inDays;
  return diff >= 0 && diff <= 6;
}
