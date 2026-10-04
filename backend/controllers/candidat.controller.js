const { asyncHandler } = require('../utils/asyncHandler');
const candidatService = require('../services/candidat.service');
const { sendResponse } = require('../utils/response.util');

const getMe = asyncHandler(async (req, res) => {
  const result = await candidatService.getMe(req.user.id);
  sendResponse(res, 200, result);
});

const updateMe = asyncHandler(async (req, res) => {
  const result = await candidatService.updateMe(req.user.id, req.body);
  sendResponse(res, 200, result);
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await candidatService.changePassword(
    req.user.id,
    req.body.currentPassword,
    req.body.newPassword
  );
  sendResponse(res, 200, result);
});

const uploadPhoto = asyncHandler(async (req, res) => {
  const result = await candidatService.uploadPhoto(req);
  sendResponse(res, 200, result);
});

const uploadCv = asyncHandler(async (req, res) => {
  const result = await candidatService.uploadCv(req);
  sendResponse(res, 200, result);
});

const deleteCv = asyncHandler(async (req, res) => {
  const result = await candidatService.deleteCv(req.user.id);
  sendResponse(res, 200, result);
});

const cvInfo = asyncHandler(async (req, res) => {
  const result = await candidatService.getCvInfo(req.user.id);
  sendResponse(res, 200, result);
});

const downloadPhoto = asyncHandler(async (req, res) => {
  const { filePath } = await candidatService.getPhotoFile(req.user.id);
  res.sendFile(filePath);
});

const downloadCv = asyncHandler(async (req, res) => {
  const { filePath } = await candidatService.getCvFile(req.user.id);
  res.sendFile(filePath);
});

module.exports = { getMe, updateMe, changePassword, uploadPhoto, uploadCv, deleteCv, cvInfo, downloadPhoto, downloadCv };
