const express = require('express');
const router = express.Router();
const c = require('../controllers/ai-interview-engine.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');

router.use(auth);

// Création d'un entretien IA vocal — réservée aux RH/ADMIN.
router.post('/create/:candidatureId', role('RH', 'ADMIN'), c.createInterview);

// Lecture / démarrage / complétion — RH/ADMIN ou candidat propriétaire.
router.get('/:id', role('RH', 'ADMIN', 'CANDIDAT'), c.getInterview);
router.post('/:id/start', role('RH', 'ADMIN', 'CANDIDAT'), c.startInterview);
router.post('/:id/answer', role('RH', 'ADMIN', 'CANDIDAT'), c.answerInterview);
router.post('/:id/complete', role('RH', 'ADMIN', 'CANDIDAT'), c.completeInterview);

// Rapport d'évaluation — données sensibles, réservées aux RH/ADMIN.
router.get('/:id/report', role('RH', 'ADMIN'), c.getReport);

module.exports = router;
