enum ApplicationStatut {
  enAttente(value: 'EN_ATTENTE', label: 'En attente'),
  acceptee(value: 'ACCEPTEE', label: 'Acceptée'),
  refusee(value: 'REFUSEE', label: 'Refusée'),
  stagiaireCree(value: 'STAGIAIRE_CREATED', label: 'Stagiaire créé');

  const ApplicationStatut({required this.value, required this.label});

  final String value;
  final String label;

  static ApplicationStatut? fromValue(String? value) {
    for (final status in values) {
      if (status.value == value) return status;
    }
    return null;
  }
}
