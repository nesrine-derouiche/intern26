require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { helmetMiddleware, securityHeaders, notFoundHandler } = require('./middlewares/security.middleware');
const { apiLimiter, authLimiter } = require('./middlewares/rateLimit.middleware');
const emailService = require('./services/email.service');
const humanInterviewReminderJob = require('./services/human-interview-reminder.job');
const mobileAccessEmailJob = require('./services/mobile-access-email.job');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// Sécurité : en-têtes HTTP (Helmet + en-têtes personnalisés)
app.use(helmetMiddleware);
app.use(securityHeaders);

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((o) => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Limitation de débit
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api', apiLimiter);

// Routage principal (Architecture Modulaire)
const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

// Gestionnaire global 404 (routes inconnues)
app.use(notFoundHandler);

// Middleware global de gestion d'erreurs
const globalErrorHandler = require('./middlewares/error.middleware');
app.use(globalErrorHandler);

const emailConfig = require('./config/email');

// Démarrage du serveur
app.listen(PORT, async () => {
  console.log(`Serveur STEG (PostgreSQL) en cours d'exécution sur http://localhost:${PORT}`);
  // Vérifier la joignabilité SMTP avant de tenter quoi que ce soit
  await emailConfig.checkSmtpReachable();
  // Vérification du transporteur SMTP (non bloquante, ne fait jamais échouer le démarrage)
  emailService.verifyTransporter();
  // Rappel automatique des entretiens humains du jour (désactivable via REMINDER_JOB_ENABLED=false)
  humanInterviewReminderJob.start();
  // Email d'accès à l'application mobile à J-1 du stage (désactivable via MOBILE_ACCESS_JOB_ENABLED=false)
  mobileAccessEmailJob.start();
});
