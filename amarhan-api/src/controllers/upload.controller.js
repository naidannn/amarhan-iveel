'use strict';

const httpStatus = require('http-status');
const APIError = require('../utils/APIError');
const { success } = require('../utils/response');

/**
 * Зураг upload хийсний дараа буцаах зам НЬ ХАРЬЦАНГУЙ (`/uploads/guides/...`) —
 * frontend үүнийг өөрийн API base URL-тэй холбоно (`usePublicContent`-ийн
 * загвартай ижил), сервер өөрийн host-оо тааж бичихгүй.
 */
exports.uploadImage = (req, res, next) => {
  if (!req.file) {
    return next(new APIError('Зураг сонгогдоогүй байна', httpStatus.BAD_REQUEST));
  }

  return success(res, { url: `/uploads/guides/${req.file.filename}` }, httpStatus.CREATED);
};
