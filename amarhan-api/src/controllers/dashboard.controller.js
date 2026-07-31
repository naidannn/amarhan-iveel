'use strict';

const dashboardService = require('../services/dashboard.service');
const { success } = require('../utils/response');

exports.summary = async (req, res, next) => {
  try {
    const result = await dashboardService.summary(req.user);
    // Токентой хариуг shared cache-д хадгалуулахгүй; process-local cache нь service дээр байна.
    res.set('Cache-Control', 'private, max-age=60');
    return success(res, result);
  } catch (error) {
    next(error);
  }
};
