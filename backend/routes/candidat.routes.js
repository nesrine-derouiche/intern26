const express = require('express');
const router = express.Router();
const candidatController = require('../controllers/candidat.controller');
const candidatService = require('../services/candidat.service');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { candidatUpdateValidation, candidatEmailUpdateValidation, candidatPasswordValidation } = require('../validators/candidat.validator');
const { validate } = require('../validators');

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

router.use(authenticateToken, requireRole('CANDIDAT', 'ADMIN'));

router.get('/me', candidatController.getMe);
router.put('/me', [...candidatEmailUpdateValidation, ...candidatUpdateValidation], validate, candidatController.updateMe);
router.put('/password', candidatPasswordValidation, validate, candidatController.changePassword);
router.post('/photo', uploadHandler(candidatService.getPhotoMiddleware(), '5 Mo'), candidatController.uploadPhoto);
router.post('/cv', uploadHandler(candidatService.getCvMiddleware(), '10 Mo'), candidatController.uploadCv);
router.delete('/cv', candidatController.deleteCv);
router.get('/cv/info', candidatController.cvInfo);
router.get('/photo', candidatController.downloadPhoto);
router.get('/cv', candidatController.downloadCv);

module.exports = router;
