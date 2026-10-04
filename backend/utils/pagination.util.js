const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const getPaginationParams = (query = {}) => {
  const hasPage = query.page !== undefined && query.page !== '';
  const hasLimit = query.limit !== undefined && query.limit !== '';
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    enabled: hasPage || hasLimit
  };
};

const buildPaginatedResult = (data, total, page, limit) => ({
  data,
  total,
  page,
  pages: limit > 0 ? Math.ceil(total / limit) : 0
});

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  getPaginationParams,
  buildPaginatedResult
};
