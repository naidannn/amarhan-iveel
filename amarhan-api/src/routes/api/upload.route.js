'use strict';

const express = require('express');
const httpStatus = require('http-status');
const router = express.Router();
const upload = require('../../middlewares/upload');
const authorize = require('../../middlewares/authorization');
const uploadController = require('../../controllers/upload.controller');
const APIError = require('../../utils/APIError');
const Constants = require('../../config/constants');

/**
 * Зурган файл upload — зөвхөн Админ (`content.address_guides`-ийн
 * thumbnail/блокийн зураг, roadmap 5.10 өргөтгөл).
 *
 * `multer`-ийн алдаа (хэт том файл, буруу төрөл) нь `err.status` тавьдаггүй тул
 * global error-handler 500 гэж үзнэ — эндээс 400 болгож дамжуулна.
 */
router.post('/images', authorize(Constants.ROLE_GROUP.ADMIN), (req, res, next) => {
  upload.single('image')(req, res, err => {
    if (err) {
      return next(new APIError(err.message || 'Зураг upload хийж чадсангүй', httpStatus.BAD_REQUEST));
    }
    return uploadController.uploadImage(req, res, next);
  });
});

module.exports = router;
