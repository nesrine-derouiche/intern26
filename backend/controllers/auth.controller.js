const { asyncHandler } = require('../utils/asyncHandler');
const authService = require('../services/auth.service');
const { sendResponse } = require('../utils/response.util');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  sendResponse(res, 200, result);
});

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendResponse(res, 201, result);
});

const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.body.token);
  sendResponse(res, 200, result);
});

const resendVerification = asyncHandler(async (req, res) => {
  const result = await authService.resendVerification(req.body.email);
  sendResponse(res, 200, result);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  sendResponse(res, 200, result);
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  sendResponse(res, 200, result);
});

const getMe = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user.id);
  sendResponse(res, 200, result);
});

const updateProfile = asyncHandler(async (req, res) => {
  const result = await authService.updateProfile(req.user.id, req.body);
  sendResponse(res, 200, result);
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(
    req.user.id,
    req.body.current_password,
    req.body.new_password
  );
  sendResponse(res, 200, result);
});

module.exports = { login, register, verifyEmail, resendVerification, forgotPassword, resetPassword, getMe, updateProfile, changePassword };
