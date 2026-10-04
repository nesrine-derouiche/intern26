const fs = require('fs');
const path = require('path');

/**
 * Gabarits d'emails STEG Internship.
 *
 * Les gabarits HTML (seuls) sont séparés de la logique métier dans
 * `backend/templates/email/`. Ce module les charge, les interpole
 * avec les valeurs fournies (échappées), et fournit également une
 * version texte de chaque email.
 *
 * Remplissage : `{{key}}` pour une valeur échappée,
 * `{{#key}}...{{/key}}` pour un bloc conditionnel (rendu si `key` est défini).
 */

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'email');

const cache = new Map();

function loadTemplate(name) {
  if (!cache.has(name)) {
    cache.set(name, fs.readFileSync(path.join(TEMPLATE_DIR, `${name}.html`), 'utf8'));
  }
  return cache.get(name);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

function renderHtml(templateName, data) {
  let html = loadTemplate(templateName);

  html = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
    const value = data[key];
    if (value === undefined || value === null || value === '' || value === false) return '';
    return inner;
  });

  html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    return escapeHtml(value === undefined || value === null ? '' : String(value));
  });

  return html;
}

const build = (templateName, subject, text, data) => ({
  subject,
  text,
  html: renderHtml(templateName, data)
});

module.exports = {
  verification: ({ lien }) => build(
    'verification',
    'Vérification de votre compte STEG Internship',
    [
      'Bonjour,',
      '',
      'Pour activer votre compte STEG Internship, veuillez cliquer sur le lien suivant :',
      '',
      lien,
      '',
      'Ce lien expirera sous 24 heures. Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email.'
    ].join('\n'),
    { lien }
  ),

  passwordReset: ({ lien }) => build(
    'password-reset',
    'Réinitialisation de votre mot de passe STEG Internship',
    [
      'Bonjour,',
      '',
      'Pour réinitialiser votre mot de passe STEG Internship, veuillez cliquer sur le lien suivant :',
      '',
      lien,
      '',
      'Ce lien expirera sous 24 heures. Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email.'
    ].join('\n'),
    { lien }
  ),

  applicationReceived: ({ nom, titreOffre }) => build(
    'application-received',
    'Votre candidature a bien été reçue',
    [
      `Bonjour ${nom},`,
      '',
      'Votre candidature pour l\'offre :',
      '',
      titreOffre,
      '',
      'a bien été enregistrée.',
      '',
      'Statut actuel :',
      '',
      'En attente de validation par le service RH.',
      '',
      'Nous vous informerons par email de la suite du processus.',
      '',
      'Merci.',
      '',
      'STEG Internship Platform'
    ].join('\n'),
    { nom, titreOffre }
  ),

  applicationRejected: ({ nom, titreOffre }) => build(
    'application-rejected',
    'Votre candidature n\'a pas été retenue',
    [
      `Bonjour ${nom},`,
      '',
      'Nous regrettons de vous informer que votre candidature pour l\'offre de stage :',
      '',
      titreOffre,
      '',
      'n\'a pas été retenue.',
      '',
      'Nous vous remercions de l\'intérêt que vous avez porté à notre plateforme et vous souhaitons plein de succès dans vos démarches.',
      '',
      'Merci.',
      '',
      'STEG Internship Platform'
    ].join('\n'),
    { nom, titreOffre }
  ),

  rhPreselection: ({ nom, titreOffre }) => build(
    'rh-preselection',
    'Vous êtes présélectionné(e) pour une offre de stage',
    [
      `Bonjour ${nom},`,
      '',
      'Votre candidature pour l\'offre de stage :',
      '',
      titreOffre,
      '',
      'a retenu l\'attention du service RH. Votre profil a été présélectionné pour la suite du processus de recrutement.',
      '',
      'Le service RH vous contactera prochainement pour la suite des étapes.',
      '',
      'Merci.',
      '',
      'STEG Internship Platform'
    ].join('\n'),
    { nom, titreOffre }
  ),

  rhPreselected: ({ nom, titreOffre, lienEntretien }) => build(
    'rh-preselected',
    'Votre candidature a été présélectionnée',
    [
      `Bonjour ${nom},`,
      '',
      'Nous avons le plaisir de vous informer que votre candidature pour l\'offre :',
      '',
      titreOffre,
      '',
      'a été présélectionnée.',
      '',
      'La prochaine étape est un entretien IA.',
      '',
      'Cliquez sur le lien ci-dessous pour commencer votre entretien :',
      '',
      lienEntretien,
      '',
      'Après validation de cet entretien, votre candidature sera examinée pour un entretien humain.',
      '',
      'Cordialement,',
      'STEG Internship Platform'
    ].join('\n'),
    { nom, titreOffre, lienEntretien }
  ),

  aiInterviewPassed: ({ nom, titreOffre, score }) => build(
    'ai-interview-passed',
    'Votre entretien IA est validé',
    [
      `Bonjour ${nom},`,
      '',
      'Félicitations ! Vous avez réussi votre entretien IA pour l\'offre de stage :',
      '',
      titreOffre,
      '',
      ...(score != null ? [`Votre score : ${score}/100`, ''] : []),
      'Votre candidature est désormais éligible pour un entretien humain avec notre équipe.',
      '',
      'Le service RH vous contactera prochainement pour convenir d\'une date.',
      '',
      'Cordialement,',
      'STEG Internship Platform'
    ].join('\n'),
    { nom, titreOffre, score }
  ),

  aiInterviewFailed: ({ nom, titreOffre }) => build(
    'ai-interview-failed',
    'Résultat de votre entretien IA',
    [
      `Bonjour ${nom},`,
      '',
      'Nous vous remercions du temps consacré à l\'entretien IA pour l\'offre de stage :',
      '',
      titreOffre,
      '',
      'Malheureusement, votre candidature n\'a pas été retenue à l\'issue de cet entretien.',
      '',
      'Nous vous remercions de l\'intérêt que vous avez porté à notre plateforme et vous souhaitons plein de succès dans vos démarches.',
      '',
      'Cordialement,',
      'STEG Internship Platform'
    ].join('\n'),
    { nom, titreOffre }
  ),

  interviewInvitation: ({ nom, titreOffre, date, lieu, lienVisio }) => build(
    'interview-invitation',
    'Invitation à un entretien',
    [
      `Bonjour ${nom},`,
      '',
      'Suite à votre candidature pour l\'offre de stage :',
      '',
      titreOffre,
      '',
      'nous avons le plaisir de vous inviter à un entretien.',
      '',
      `Date : ${date || 'à confirmer'}`,
      ...(lieu ? [`Lieu : ${lieu}`] : []),
      ...(lienVisio ? [`Lien de visioconférence : ${lienVisio}`] : []),
      '',
      'Merci de confirmer votre présence en répondant à cet email.',
      '',
      'Cordialement,',
      'Le service RH de la STEG.'
    ].join('\n'),
    { nom, titreOffre, date, lieu, lienVisio }
  ),

  internshipAccepted: ({ nom, titreOffre, dateDebut }) => build(
    'internship-accepted',
    'Félicitations ! Votre candidature a été acceptée',
    [
      `Bonjour ${nom},`,
      '',
      'Nous avons le plaisir de vous informer que votre candidature pour le stage :',
      '',
      titreOffre,
      '',
      'a été acceptée.',
      '',
      ...(dateDebut ? [`Votre stage débutera le ${dateDebut}.`, ''] : []),
      'Vous recevrez très prochainement les informations pratiques pour votre intégration.',
      '',
      'Toutes nos félicitations !',
      '',
      'STEG Internship Platform'
    ].join('\n'),
    { nom, titreOffre, dateDebut }
  ),

  humanInterviewInvitation: ({ nom, titreOffre, date, heure, interviewer, lienVisio }) => build(
    'human-interview-invitation',
    'Votre entretien humain est planifié',
    [
      `Bonjour ${nom},`,
      '',
      'Félicitations pour votre réussite à l\'entretien IA pour l\'offre de stage :',
      '',
      titreOffre,
      '',
      'Nous avons le plaisir de vous convier à un entretien humain avec notre équipe.',
      '',
      `Date : ${date}`,
      `Heure : ${heure}`,
      `Intervieweur : ${interviewer}`,
      ...(lienVisio ? [`Lien de visioconférence : ${lienVisio}`] : []),
      '',
      'Merci de vous présenter quelques minutes à l\'avance et de confirmer votre présence en répondant à cet email.',
      '',
      'Cordialement,',
      'Le service RH de la STEG.'
    ].join('\n'),
    { nom, titreOffre, date, heure, interviewer, lienVisio }
  ),

  humanInterviewReminder: ({ nom, titreOffre, date, heure, duree, interviewer, lienVisio }) => build(
    'human-interview-reminder',
    'Reminder — Your STEG human interview is today',
    [
      `Hello ${nom},`,
      '',
      `This is a reminder that your human interview for the internship position "${titreOffre}" is scheduled for today.`,
      '',
      `Date: ${date}`,
      `Time: ${heure}`,
      `Duration: ${duree}`,
      '',
      'Interviewer:',
      interviewer,
      '',
      'Join the interview:',
      lienVisio,
      '',
      'Please join the meeting a few minutes before the scheduled time.',
      '',
      'Best regards,',
      'STEG Internship — Human Resources'
    ].join('\n'),
    { nom, titreOffre, date, heure, duree, interviewer, lienVisio }
  ),

  mobileAccess: ({ nom, dateDebut, username, password, downloadUrl }) => build(
    'mobile-access',
    'Votre accès à l\'application STEG Internship',
    [
      `Bonjour ${nom},`,
      '',
      `Votre stage débutera le ${dateDebut}.`,
      '',
      'Votre accès à l\'application mobile STEG Internship est maintenant disponible.',
      '',
      'Identifiant :',
      username,
      '',
      'Mot de passe temporaire :',
      password,
      '',
      ...(downloadUrl ? ['Télécharger l\'application :', downloadUrl, ''] : []),
      'Instructions :',
      '1. Téléchargez l\'application.',
      '2. Ouvrez l\'application.',
      '3. Connectez-vous avec les identifiants ci-dessus.',
      '4. Suivez les étapes demandées dans l\'application.',
      '',
      'Pour des raisons de sécurité, ne partagez jamais vos identifiants.',
      '',
      'Cordialement,',
      'STEG Internship Platform'
    ].join('\n'),
    { nom, dateDebut, username, password, downloadUrl }
  ),

  documentsRequest: ({ nom, titreOffre, dateDebut, documents }) => build(
    'documents-request',
    'Documents requis pour votre stage',
    [
      `Bonjour ${nom},`,
      '',
      'Félicitations ! Votre candidature pour le stage :',
      '',
      titreOffre,
      '',
      ...(dateDebut ? [`a été acceptée. Votre stage débutera le ${dateDebut}.`, ''] : ['a été acceptée.', '']),
      'Afin de finaliser votre intégration, merci de nous fournir les documents suivants :',
      '',
      ...(Array.isArray(documents) ? documents.map((doc) => `- ${doc}`) : [documents]),
      '',
      'Vous pouvez déposer ces documents directement sur votre espace personnel de la plateforme.',
      '',
      'Toutes nos félicitations !',
      '',
      'STEG Internship Platform'
    ].join('\n'),
    { nom, titreOffre, dateDebut, documents: Array.isArray(documents) ? documents.join(', ') : documents }
  ),

  welcome: ({ prenom, nom, lien }) => build(
    'welcome',
    'Bienvenue sur STEG Internship',
    [
      `Bonjour ${prenom} ${nom},`,
      '',
      'Votre compte a bien été créé sur la plateforme STEG Internship. Vous pouvez dès maintenant parcourir les offres de stage disponibles, postuler et suivre l\'avancement de vos candidatures.',
      '',
      `Accédez à la plateforme : ${lien}`,
      '',
      'N\'oubliez pas de vérifier votre adresse email pour activer votre compte.',
      '',
      'Toute l\'équipe vous souhaite la bienvenue.',
      '',
      'STEG Internship Platform'
    ].join('\n'),
    { prenom, nom, lien }
  )
};
