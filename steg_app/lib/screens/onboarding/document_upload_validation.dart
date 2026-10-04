/// Extensions acceptées pour le dépôt des documents du dossier.
///
/// Alignées sur le backend (`document.service.js`) : le serveur reste
/// l'autorité finale, ce contrôle évite un aller-retour inutile.
const List<String> documentUploadAllowedExtensions = [
  'pdf',
  'doc',
  'docx',
  'png',
  'jpg',
  'jpeg',
];

/// Taille maximale (octets) d'un document du dossier (10 Mo, comme le backend).
const int documentUploadMaxSizeBytes = 10 * 1024 * 1024;

/// Vérifie un fichier avant son envoi.
///
/// Retourne `null` si le fichier est acceptable, sinon un message d'erreur
/// clair destiné au candidat.
String? validateDocumentFile({
  required String fileName,
  required int sizeBytes,
}) {
  if (sizeBytes > documentUploadMaxSizeBytes) {
    return 'Fichier trop volumineux. Taille maximale : 10 Mo.';
  }
  final extension = _extensionOf(fileName);
  if (extension == null || !documentUploadAllowedExtensions.contains(extension)) {
    return 'Type de fichier non autorisé (PDF, DOC, DOCX, PNG, JPG, JPEG).';
  }
  return null;
}

String? _extensionOf(String fileName) {
  final dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot == fileName.length - 1) return null;
  return fileName.substring(dot + 1).toLowerCase();
}
