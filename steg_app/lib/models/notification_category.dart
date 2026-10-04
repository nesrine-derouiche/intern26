enum NotificationCategory {
  taches('TACHE', 'Tâches'),
  reunions('REUNION', 'Réunions'),
  documents('DOCUMENT', 'Documents'),
  candidatures('CANDIDATURE', 'Candidatures'),
  evaluations('EVALUATION', 'Évaluations'),
  journal('JOURNAL', 'Journal'),
  info('INFO', 'Informations');

  const NotificationCategory(this.value, this.label);

  final String value;
  final String label;

  static NotificationCategory fromValue(String? value) {
    return values.firstWhere(
      (category) => category.value == value,
      orElse: () => info,
    );
  }
}
