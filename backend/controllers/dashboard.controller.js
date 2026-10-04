const { asyncHandler } = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');
const { sendResponse } = require('../utils/response.util');

const getStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getStats(req.user, req.scope);
  sendResponse(res, 200, stats);
});

module.exports = { getStats };
