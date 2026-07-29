'use strict';

const tariffService = require('../services/tariff.service');
const { success, created } = require('../utils/response');

exports.listCargoTypes = async (req, res, next) => {
  try {
    const result = await tariffService.listCargoTypes(req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getCargoType = async (req, res, next) => {
  try {
    const cargoType = await tariffService.getCargoType(req.params.cargoTypeId);
    return success(res, cargoType);
  } catch (error) {
    next(error);
  }
};

exports.createCargoType = async (req, res, next) => {
  try {
    const result = await tariffService.createCargoType(req.body, req.user, req);
    return created(res, result);
  } catch (error) {
    next(error);
  }
};

exports.updateCargoType = async (req, res, next) => {
  try {
    const cargoType = await tariffService.updateCargoType(
      req.params.cargoTypeId,
      req.body,
      req.user,
      req
    );
    return success(res, cargoType);
  } catch (error) {
    next(error);
  }
};

exports.listActiveTariffs = async (req, res, next) => {
  try {
    const tariffs = await tariffService.listActiveTariffs();
    return success(res, tariffs);
  } catch (error) {
    next(error);
  }
};

exports.listTariffHistory = async (req, res, next) => {
  try {
    const history = await tariffService.listTariffHistory(req.params.cargoTypeId);
    return success(res, history);
  } catch (error) {
    next(error);
  }
};

exports.changeTariff = async (req, res, next) => {
  try {
    const tariff = await tariffService.changeTariff(
      req.params.cargoTypeId,
      req.body,
      req.user,
      req
    );
    return created(res, tariff);
  } catch (error) {
    next(error);
  }
};

/**
 * Ачаа бүртгэхийн өмнө үнийг урьдчилан харах (§1.2).
 */
exports.quote = async (req, res, next) => {
  try {
    const result = await tariffService.quote(req.body);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};
