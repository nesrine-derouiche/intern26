const express = require('express');
const router = express.Router();
const multer = require('multer');
const c = require('../controllers/ai-interview.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');

// Upload d'une réponse vocale (MediaRecorder) — conservé en mémoire, 25 Mo max.
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** Convertit les erreurs multer (taille, filtre) en réponses 400 lisibles. */
const uploadHandler = (middleware, maxLabel) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `Fichier trop volumineux. Taille maximale : ${maxLabel}.`
        : err.message;
    return res.status(400).json({ success: false, message });
  });
};

router.use(auth);
// État du service IA (health) : déclaré AVANT `/:token` pour ne pas être capturé.
router.get('/health', role('CANDIDAT'), c.pythonHealth);
router.get('/:token', role('CANDIDAT'), c.getInterview);
router.post('/:token/commencer', role('CANDIDAT'), c.startInterview);
router.put('/:token/reponses/:numero', role('CANDIDAT'), c.saveAnswer);
router.post('/:token/audio', role('CANDIDAT'), uploadHandler(audioUpload.single('audio'), '25 Mo'), c.answerInterviewAudio);
router.post('/:token/synthesize', role('CANDIDAT'), c.synthesize);
router.post('/:token/integrity', role('CANDIDAT'), c.reportIntegrity);
router.post('/:token/fingerprint', role('CANDIDAT'), c.reportFingerprint);
router.post('/:token/terminer', role('CANDIDAT'), c.completeInterview);
router.post('/:token/quitter', role('CANDIDAT'), c.quitInterview);

module.exports = router;
