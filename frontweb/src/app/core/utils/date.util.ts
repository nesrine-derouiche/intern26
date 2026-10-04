/** Utilitaires de formatage des dates d'offres. */

/**
 * Formate une date ISO (YYYY-MM-DD) en « 12 août » (fr-FR).
 * Le « T00:00:00 » évite le décalage horaire de parsing UTC.
 */
export function formatDeadline(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${iso}T00:00:00`));
}
