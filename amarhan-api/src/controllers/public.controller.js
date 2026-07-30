'use strict';

const publicService = require('../services/public.service');
const { success } = require('../utils/response');

exports.track = async (req, res, next) => {
  try {
    return success(res, await publicService.track(req.params.trackingNumber));
  } catch (error) {
    next(error);
  }
};

exports.content = async (req, res, next) => {
  try {
    return success(res, await publicService.content());
  } catch (error) {
    next(error);
  }
};
