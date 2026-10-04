const sendResponse = (res, statusCode, data, message = '') => {
  const hasData = data !== null && data !== undefined;

  if (!message && hasData) {
    return res.status(statusCode).json(data);
  }

  const response = {};
  if (message) response.message = message;

  if (hasData) {
    if (typeof data === 'object' && !Array.isArray(data)) {
      Object.assign(response, data);
    } else {
      response.data = data;
    }
  }

  res.status(statusCode).json(response);
};

module.exports = {
  sendResponse
};
