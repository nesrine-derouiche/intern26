const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const {
  loginValidation,
  registerValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  profileUpdateValidation,
  changePasswordValidation
} = require('../validators/auth.validator');
const { validate } = require('../validators');

router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);
router.post('/verify-email', verifyEmailValidation, validate, authController.verifyEmail);
router.post('/verify-email/resend', resendVerificationValidation, validate, authController.resendVerification);
router.post('/forgot-password', forgotPasswordValidation, validate, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, validate, authController.resetPassword);
router.get('/me', authenticateToken, authController.getMe);
router.put('/profile', authenticateToken, profileUpdateValidation, validate, authController.updateProfile);
router.put('/change-password', authenticateToken, changePasswordValidation, validate, authController.changePassword);

module.exports = router;
