'use strict';

const reportService = require('../services/report.service');
const { success } = require('../utils/response');

exports.summary = async (req, res, next) => {
  try {
    const result = await reportService.summary(req.user, req.query.period);
    res.set('Cache-Control', `private, max-age=${result.cacheTtlSeconds}`);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};
