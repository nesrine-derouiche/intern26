const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
        Title: 'Documentation Technique — Plateforme STEG Internship',
        Author: 'STEG Internship Platform',
        Subject: 'Architecture, Email, Intelligence Artificielle',
        CreationDate: new Date(),
    }
});

const output = fs.createWriteStream(path.join(__dirname, 'STEG_Documentation_Technique.pdf'));
doc.pipe(output);

// ─── Colors ───
const STEG_BLUE = '#1a5276';
const STEG_LIGHT = '#2980b9';
const DARK = '#2c3e50';
const GRAY = '#7f8c8d';
const LIGHT_BG = '#eaf2f8';
const WHITE = '#ffffff';

// ─── Helpers ───
function drawHeader() {
    doc.rect(0, 0, 595.28, 90).fill(STEG_BLUE);
    doc.fontSize(22).fillColor(WHITE).font('Helvetica-Bold')
        .text('STEG Internship Platform', 50, 28, { width: 495 });
    doc.fontSize(11).fillColor('#aed6f1').font('Helvetica')
        .text('Documentation Technique — Architecture, Email & Intelligence Artificielle', 50, 56, { width: 495 });
    doc.fontSize(9).fillColor('#85c1e9').text('Septembre 2026', 50, 72);
}

function sectionTitle(num, title) {
    if (doc.y > 680) doc.addPage();
    doc.moveDown(1.2);
    doc.rect(50, doc.y - 4, 495, 28).fill(LIGHT_BG);
    doc.fontSize(14).fillColor(STEG_BLUE).font('Helvetica-Bold')
        .text(`${num}. ${title}`, 58, doc.y + 2);
    doc.moveDown(0.8);
    doc.fillColor(DARK);
}

function subTitle(title) {
    if (doc.y > 720) doc.addPage();
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(STEG_LIGHT).font('Helvetica-Bold').text(title);
    doc.moveDown(0.3);
    doc.fillColor(DARK);
}

function body(text) {
    if (doc.y > 740) doc.addPage();
    doc.fontSize(10).fillColor(DARK).font('Helvetica').text(text, { lineGap: 3 });
}

function bullet(text) {
    if (doc.y > 740) doc.addPage();
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(`  •  ${text}`, { lineGap: 2, indent: 10 });
}

function code(text) {
    if (doc.y > 730) doc.addPage();
    doc.save();
    doc.rect(60, doc.y - 2, 475, 18).fill('#f4f6f7');
    doc.restore();
    doc.fontSize(9).fillColor('#2c3e50').font('Courier')
        .text(text, 66, doc.y + 2, { width: 465 });
    doc.moveDown(0.4);
    doc.fillColor(DARK);
}

function tableRow(cols, widths, bold = false) {
    const y = doc.y;
    const font = bold ? 'Helvetica-Bold' : 'Helvetica';
    let x = 55;
    cols.forEach((col, i) => {
        doc.fontSize(9).fillColor(bold ? STEG_BLUE : DARK).font(font)
            .text(col, x, y, { width: widths[i], lineBreak: false });
        x += widths[i] + 10;
    });
    doc.moveDown(0.35);
}

function tableSeparator() {
    doc.moveTo(55, doc.y).lineTo(540, doc.y).strokeColor('#d5dbdb').lineWidth(0.5).stroke();
    doc.moveDown(0.2);
}

// ════════════════════════════════════════════════════════════════
// PAGE 1 — COVER
// ════════════════════════════════════════════════════════════════
doc.rect(0, 0, 595.28, 841.89).fill(STEG_BLUE);

doc.fontSize(32).fillColor(WHITE).font('Helvetica-Bold')
    .text('STEG', 50, 200, { align: 'center' });
doc.fontSize(32).fillColor(WHITE).font('Helvetica-Bold')
    .text('Internship Platform', 50, 240, { align: 'center' });

doc.moveTo(150, 290).lineTo(445, 290).strokeColor('#85c1e9').lineWidth(2).stroke();

doc.fontSize(14).fillColor('#aed6f1').font('Helvetica')
    .text('Documentation Technique Complète', 50, 310, { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(12).fillColor('#85c1e9')
    .text('Architecture · Email · Intelligence Artificielle', 50, 335, { align: 'center' });

doc.moveDown(3);
doc.fontSize(11).fillColor('#d4e6f1').font('Helvetica')
    .text('Société Tunisienne de l\'Électricité et du Gaz', 50, 420, { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(10).fillColor('#85c1e9')
    .text('Système de Gestion des Stages et Opportunités Professionnelles', 50, 440, { align: 'center' });

doc.moveDown(4);
doc.fontSize(10).fillColor('#85c1e9').font('Helvetica')
    .text('Version 1.0 — Septembre 2026', 50, 520, { align: 'center' });

doc.addPage();

// ════════════════════════════════════════════════════════════════
// PAGE 2 — TABLE DES MATIÈRES
// ════════════════════════════════════════════════════════════════
drawHeader();
doc.moveDown(1.5);

doc.fontSize(14).fillColor(STEG_BLUE).font('Helvetica-Bold').text('Table des Matières');
doc.moveDown(0.8);

const toc = [
    ['1', 'Envoi d\'Emails — Nodemailer + Gmail SMTP', '3'],
    ['1.1', 'Stack et configuration', '3'],
    ['1.2', 'Fonctionnement interne', '3'],
    ['1.3', 'Templates et automatisation', '4'],
    ['2', 'Intelligence Artificielle — Moteur de règles', '5'],
    ['2.1', 'Réponse : Aucun LLM utilisé', '5'],
    ['2.2', 'Moteur d\'entretien IA (Python)', '5'],
    ['2.3', 'Synthèse vocale (TTS)', '6'],
    ['2.4', 'Transcription vocale (STT)', '6'],
    ['2.5', 'Vérification documentaire', '7'],
    ['2.6', 'Analyse de CV', '7'],
    ['3', 'Architecture — Monolith Modulaire + Microservice', '8'],
    ['3.1', 'Vue d\'ensemble', '8'],
    ['3.2', 'Couche backend (Node.js/Express)', '9'],
    ['3.3', 'Microservice IA (Python/FastAPI)', '10'],
    ['3.4', 'Frontends (Angular + Flutter)', '10'],
    ['3.5', 'Sécurité', '11'],
    ['3.6', 'Stack technologique complet', '11'],
];

toc.forEach(([num, title, page]) => {
    doc.fontSize(10).fillColor(DARK).font('Helvetica');
    const indent = num.includes('.') ? 20 : 0;
    doc.text(`${num}   ${title}`, 55 + indent, doc.y, { width: 440 - indent, lineBreak: false });
    doc.text(page, 500, doc.y - 14, { width: 40, align: 'right' });
    doc.moveDown(0.15);
});

// ════════════════════════════════════════════════════════════════
// SECTION 1 — EMAIL
// ════════════════════════════════════════════════════════════════
doc.addPage();
drawHeader();
sectionTitle('1', 'Envoi d\'Emails — Nodemailer + Gmail SMTP');

subTitle('1.1  Stack et configuration');
body('L\'envoi d\'emails repose sur nodemailer v9.0.4, une bibliothèque Node.js populaire pour l\'envoi de courriers via SMTP. Aucun service transactionnel externe (SendGrid, Mailgun, etc.) n\'est utilisé — l\'envoi se fait directement via le serveur SMTP de Gmail.');
doc.moveDown(0.3);

const emailWidths = [120, 360];
tableRow(['Élément', 'Détail'], emailWidths, true);
tableSeparator();
tableRow(['Package npm', 'nodemailer v9.0.4'], emailWidths);
tableRow(['Fournisseur SMTP', 'Gmail (smtp.gmail.com:587, STARTTLS)'], emailWidths);
tableRow(['Compte', 'nderouiche28@gmail.com + mot de passe d\'application'], emailWidths);
tableRow(['Config', 'backend/config/email.js (l.27-36)'], emailWidths);
tableRow(['Variables .env', 'MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM'], emailWidths);
tableRow(['Transporter', 'nodemailer.createTransport() avec timeout 10s'], emailWidths);

subTitle('1.2  Fonctionnement interne');
body('Le flux d\'envoi suit ces étapes :');
doc.moveDown(0.2);
bullet('Création du transporter au démarrage du serveur (config/email.js)');
bullet('Service email.service.js — méthode sendEmail() avec retry (3 tentatives, 1s délai)');
bullet('Envoi via transporter.sendMail() — ne l\'exception jamais, retourne null en cas d\'échec');
bullet('Vérification de la connexion SMTP au démarrage (verifyTransporter)');
doc.moveDown(0.3);

subTitle('1.3  Templates et automatisation');
body('15 templates HTML dans backend/templates/email/ avec moteur de interpolation {{key}} :');
doc.moveDown(0.2);

const tplWidths = [180, 290];
tableRow(['Template', 'Usage'], tplWidths, true);
tableSeparator();
tableRow(['verification.html', 'Vérification de compte'], tplWidths);
tableRow(['password-reset.html', 'Réinitialisation mot de passe'], tplWidths);
tableRow(['application-received.html', 'Confirmation candidature'], tplWidths);
tableRow(['ai-interview-passed.html', 'Résultat entretien IA réussi'], tplWidths);
tableRow(['human-interview-invitation.html', 'Invitation entretien humain'], tplWidths);
tableRow(['internship-accepted.html', 'Acceptation de stage'], tplWidths);
tableRow(['mobile-access.html', 'Credentials app mobile (D-1)'], tplWidths);
doc.moveDown(0.3);

body('2 jobs automatiques en arrière-plan (setInterval) :');
bullet('Rappels entretiens humains — toutes les 5 minutes, vérifie les entretiens du jour');
bullet('Envoi credentials mobile — toutes les 1 heure, envoie les accès aux candidats dont le stage démarre demain');

// ════════════════════════════════════════════════════════════════
// SECTION 2 — IA
// ════════════════════════════════════════════════════════════════
doc.addPage();
drawHeader();
sectionTitle('2', 'Intelligence Artificielle — Moteur de règles');

subTitle('2.1  Réponse : Aucun LLM utilisé');
body('Le projet n\'utilise AUCUN modèle de langage (LLM). Il n\'y a aucun appel à OpenAI GPT, Google Gemini, Anthropic Claude, ou tout autre LLM. L\'IA est entièrement déterministe, basée sur des règles et des formules arithmétiques. Le même input produit toujours le même output.');
doc.moveDown(0.3);

body('Packages Python installés : fastapi, pydantic, httpx, edge-tts, pypdf, python-docx. Aucun package d\'IA/ML : pas de openai, anthropic, langchain, transformers, torch.');
doc.moveDown(0.3);

subTitle('2.2  Moteur d\'entretien IA (Python)');
body('Fichier : ai-service/app/services/interview_engine.py (610 lignes)');
doc.moveDown(0.2);

const aiWidths = [130, 340];
tableRow(['Aspect', 'Détail'], aiWidths, true);
tableSeparator();
tableRow(['Approche', 'Moteur de règles par mots-clés, 100% déterministe'], aiWidths);
tableRow(['Questionn.', '8 questions sur 8 catégories (PRESENTATION, MOTIVATION, etc.)'], aiWidths);
tableRow(['Adaptation', 'Détection de mots-clés dans la réponse pour la question suivante'], aiWidths);
tableRow(['Scoring', 'Formule pondérée : mots-clés trouvés × poids par catégorie'], aiWidths);
tableRow(['Évaluation', 'Score final /20 avec verdict PASSED/FAILED'], aiWidths);
tableRow(['Intégrité', 'Détection de changement de device, fingerprinting'], aiWidths);
doc.moveDown(0.3);

subTitle('2.3  Synthèse vocale (TTS)');
body('Fichier : ai-service/app/services/text_to_speech.py (471 lignes)');
doc.moveDown(0.2);

const ttsWidths = [100, 140, 230];
tableRow(['Priorité', 'Fournisseur', 'Détail'], ttsWidths, true);
tableSeparator();
tableRow(['1', 'OpenAI TTS', 'tts-1 / nova — si TTS_API_KEY configuré'], ttsWidths);
tableRow(['2', 'edge-tts', 'Voix Microsoft fr-FR-DeniseNeural, gratuit'], ttsWidths);
tableRow(['3', 'Voix système', 'macOS say / Linux espeak-ng'], ttsWidths);
tableRow(['4', 'Mock', 'Génère WAV audible, pour tests uniquement'], ttsWidths);
doc.moveDown(0.3);
body('En production, edge-tts (Microsoft) est utilisé car gratuit et sans clé API. La voix est naturelle et de haute qualité.');

subTitle('2.4  Transcription vocale (STT)');
body('Fichier : ai-service/app/services/speech_to_text.py (306 lignes)');
doc.moveDown(0.2);
bullet('Fournisseur 1 : OpenAI Whisper API (whisper-1) — si STT_API_KEY configuré');
bullet('Fournisseur 2 : Mock — retourne du texte français hardcoded (utilisé en prod)');
doc.moveDown(0.3);
body('Le mode mock est utilisé car les clés API ne sont pas configurées dans .env. Si une clé OpenAI était ajoutée, le Whisper serait automatiquement utilisé.');

doc.addPage();
drawHeader();
subTitle('2.5  Vérification documentaire');
body('Fichier : ai-service/app/services/document_verification.py (677 lignes)');
doc.moveDown(0.2);

body('Système 100% rules-based sans ML :');
bullet('Extraction texte : pypdf (PDF), python-docx (DOCX), textutil (DOC sur macOS), tesseract (OCR images)');
bullet('Détection type document : scoring par mots-clés pondérés');
bullet('Vérification nom candidat : recherche de chaîne dans le texte');
bullet('Vérification CIN : regex \\b\\d{8}\\b');
bullet('Score de confiance : formule additive avec seuils VALID / REVIEW_REQUIRED / REJECTED');
doc.moveDown(0.3);

subTitle('2.6  Analyse de CV');
body('Fichier : backend/services/cv-analysis.service.js (168 lignes)');
doc.moveDown(0.2);
bullet('Provider : moteur-regles-v1 (100% déterministe)');
bullet('Comparaison par mots-clés entre compétences candidat et exigences offre');
bullet('Aucun appel externe — traitement local');
doc.moveDown(0.3);

// ════════════════════════════════════════════════════════════════
// SECTION 3 — ARCHITECTURE
// ════════════════════════════════════════════════════════════════
doc.addPage();
drawHeader();
sectionTitle('3', 'Architecture — Monolith Modulaire + Microservice');

subTitle('3.1  Vue d\'ensemble');
body('L\'architecture est hybride : un backend monolithique modulaire (Node.js/Express) couplé à un microservice dédié à l\'IA (Python/FastAPI), communiquant via HTTP REST avec authentification par service token.');
doc.moveDown(0.4);

doc.fontSize(10).fillColor(DARK).font('Courier');
doc.text('┌──────────────┐    ┌──────────────┐    ┌──────────────┐');
doc.text('│  frontweb/   │    │ backoffice/  │    │  steg_app/   │');
doc.text('│  Angular 22  │    │  Angular 22  │    │   Flutter    │');
doc.text('│   :4200      │    │   :4400      │    │   mobile     │');
doc.text('└──────┬───────┘    └──────┬───────┘    └──────┬───────┘');
doc.text('       │   HTTP/REST       │  HTTP/REST        │  HTTP/REST');
doc.text('       └───────────┬───────┴───────────────────┘');
doc.text('                   v');
doc.text('          ┌────────────────┐     HTTP      ┌────────────────┐');
doc.text('          │   backend/     │ ────────────> │  ai-service/   │');
doc.text('          │ Node.js/Express│ <──────────── │ Python/FastAPI │');
doc.text('          │    :3000       │              │    :8001       │');
doc.text('          └───────┬────────┘              └────────────────┘');
doc.text('                  │ SQL');
doc.text('                  v');
doc.text('         ┌────────────────┐');
doc.text('         │  PostgreSQL    │');
doc.text('         │  (steg_stage)  │');
doc.text('         └────────────────┘');
doc.moveDown(0.5);
doc.fillColor(DARK);

subTitle('3.2  Couche backend (Node.js/Express)');
body('Pattern : Route → Middleware (auth/rôle) → Controller → Service → Repository → PostgreSQL');
doc.moveDown(0.3);

const layerWidths = [110, 80, 300];
tableRow(['Couche', 'Fichiers', 'Responsabilité'], layerWidths, true);
tableSeparator();
tableRow(['Routes', '22 fichiers', 'Mapping HTTP, validation express-validator'], layerWidths);
tableRow(['Middlewares', '7 fichiers', 'JWT, RBAC (5 rôles), authorization objet, rate limiting'], layerWidths);
tableRow(['Controllers', '22 fichiers', 'Parsing requête, formatage réponse'], layerWidths);
tableRow(['Services', '36 fichiers', 'Logique métier, orchestration, email, IA'], layerWidths);
tableRow(['Repositories', '26 fichiers', 'Requêtes SQL via pool pg'], layerWidths);
tableRow(['Validators', '—', 'express-validator sur toutes les routes'], layerWidths);
doc.moveDown(0.3);

body('Principes clés :');
bullet('Séparation stricte des couches — chaque couche ne communique qu\'avec sa couche adjacente');
bullet('Services métier purs (pas de requête HTTP directe dans les controllers)');
bullet('Repositories encapsulent toute la logique SQL');
bullet('Transactions DB via withTransaction() helper');

doc.addPage();
drawHeader();

subTitle('3.3  Microservice IA (Python/FastAPI)');
body('Fichier : ai-service/app/main.py — port 8001');
doc.moveDown(0.2);

const microWidths = [140, 330];
tableRow(['Route', 'Fonction'], microWidths, true);
tableSeparator();
tableRow(['/v1/interview/start', 'Démarre une session d\'entretien vocal'], microWidths);
tableRow(['/v1/interview/answer', 'Enregistre réponse et retourne score'], microWidths);
tableRow(['/v1/interview/complete', 'Termine et retourne le rapport'], microWidths);
tableRow(['/v1/tts/synthesize', 'Synthèse texte → audio'], microWidths);
tableRow(['/v1/stt/transcribe', 'Transcription audio → texte'], microWidths);
tableRow(['/api/documents/verify', 'Vérification automatique de documents'], microWidths);
tableRow(['/health', 'Healthcheck'], microWidths);
doc.moveDown(0.3);

body('Communication Node → Python :');
bullet('HTTP REST avec fetch() — timeout configurable (PYTHON_AI_TIMEOUT_MS)');
bullet('Authentification : header X-Service-Token avec comparaison à temps constant');
bullet('Pas de message queue — communication synchrone');
doc.moveDown(0.3);

subTitle('3.4  Frontends (Angular + Flutter)');

const frontWidths = [100, 100, 130, 160];
tableRow(['App', 'Framework', 'Port', 'Usage'], frontWidths, true);
tableSeparator();
tableRow(['backoffice/', 'Angular 22', ':4400', 'Panel admin/RH (Berry template)'], frontWidths);
tableRow(['frontweb/', 'Angular 22', ':4200', 'Portail candidat public'], frontWidths);
tableRow(['steg_app/', 'Flutter', 'N/A', 'App mobile stagiaire (Riverpod)'], frontWidths);
doc.moveDown(0.3);

subTitle('3.5  Sécurité');

const secWidths = [140, 330];
tableRow(['Mécanisme', 'Implémentation'], secWidths, true);
tableSeparator();
tableRow(['Authentification', 'JWT (24h) + bcrypt (12 rounds)'], secWidths);
tableRow(['Rate limiting', 'express-rate-limit : 1000 req/15min, 50 req/15min (auth)'], secWidths);
tableRow(['Headers', 'Helmet + middleware custom'], secWidths);
tableRow(['CORS', 'Whitelist : localhost:4200, localhost:4400'], secWidths);
tableRow(['RBAC', '5 rôles : ADMIN, RH, CHEF_DEP, ENCADRANT, STAGIAIRE'], secWidths);
tableRow(['Autorisation objet', 'scope.util.js + authorization.service.js'], secWidths);
tableRow(['Push', 'Firebase Cloud Messaging (firebase-admin)'], secWidths);
tableRow(['Validation', 'express-validator sur toutes les routes'], secWidths);
tableRow(['Uploads', 'Multer avec vérification type/taille'], secWidths);
doc.moveDown(0.3);

subTitle('3.6  Stack technologique complet');

const stackWidths = [120, 100, 250];
tableRow(['Catégorie', 'Technologie', 'Détail'], stackWidths, true);
tableSeparator();
tableRow(['Backend', 'Node.js', 'Express 5.2.1, 22 routes, 30+ services'], stackWidths);
tableRow(['Base de données', 'PostgreSQL', 'pg 8.22.0, 21 tables, 6 enums, pool'], stackWidths);
tableRow(['Auth', 'JWT + bcrypt', 'jsonwebtoken 9.0.3, bcrypt 6.0.0'], stackWidths);
tableRow(['Email', 'Nodemailer', 'SMTP Gmail direct, 15 templates HTML'], stackWidths);
tableRow(['Push', 'Firebase', 'firebase-admin 14.2.0, FCM'], stackWidths);
tableRow(['Service IA', 'Python', 'FastAPI 0.115.6, uvicorn, pydantic'], stackWidths);
tableRow(['TTS', 'edge-tts', 'Voix Microsoft gratuites'], stackWidths);
tableRow(['STT', 'Mock / Whisper', 'Mock par défaut, Whisper optionnel'], stackWidths);
tableRow(['Front office', 'Angular 22', '2 SPA : backoffice (:4400) + frontweb (:4200)'], stackWidths);
tableRow(['Mobile', 'Flutter', 'Riverpod, GoRouter, Dio'], stackWidths);
tableRow(['PDF', 'pdfkit', 'Génération rapports'], stackWidths);
tableRow(['Upload', 'Multer', 'Stockage fichiers ./uploads/'], stackWidths);
doc.moveDown(0.5);

// Footer
doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(STEG_BLUE).lineWidth(1).stroke();
doc.moveDown(0.3);
doc.fontSize(9).fillColor(GRAY).font('Helvetica')
    .text('Document généré automatiquement — STEG Internship Platform — Septembre 2026', 50, doc.y, { align: 'center' });

// ════════════════════════════════════════════════════════════════
// SAVE
// ════════════════════════════════════════════════════════════════
doc.end();

output.on('finish', () => {
    const stats = fs.statSync(path.join(__dirname, 'STEG_Documentation_Technique.pdf'));
    console.log(`PDF generated: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`Location: ${path.join(__dirname, 'STEG_Documentation_Technique.pdf')}`);
});
