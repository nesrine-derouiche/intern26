const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const publicController = require('../controllers/public.controller');
const { validate } = require('../validators');

router.get('/offres', publicController.getOffres);
router.get('/offres/:id', param('id').isUUID().withMessage('ID offre invalide.'), validate, publicController.getOffreById);

module.exports = router;
