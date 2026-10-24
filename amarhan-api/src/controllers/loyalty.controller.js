'use strict';

const loyaltyService = require('../services/loyalty.service');
const { success } = require('../utils/response');

exports.stats = async (req, res, next) => {
  try {
    return success(res, await loyaltyService.programStats());
  } catch (error) {
    next(error);
  }
};
