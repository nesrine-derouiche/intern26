const { asyncHandler } = require('../utils/asyncHandler');
const searchService = require('../services/search.service');
const { sendResponse } = require('../utils/response.util');

const search = asyncHandler(async (req, res) => {
  const results = await searchService.search(req.query, req.user, req.scope);
  sendResponse(res, 200, results);
});

module.exports = { search };
