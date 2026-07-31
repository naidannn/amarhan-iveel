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

exports.trackByPhone = async (req, res, next) => {
  try {
    const result = await publicService.trackByPhone(req.params.phone, req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.pricing = async (req, res, next) => {
  try {
    return success(res, await publicService.pricing());
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
