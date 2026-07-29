'use strict';

const warehouseLocationService = require('../services/warehouse-location.service');
const { success, created } = require('../utils/response');

exports.list = async (req, res, next) => {
  try {
    const result = await warehouseLocationService.list(req.query, req.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const location = await warehouseLocationService.getById(req.params.locationId);
    return success(res, location);
  } catch (error) {
    next(error);
  }
};

exports.getByCode = async (req, res, next) => {
  try {
    const location = await warehouseLocationService.getByCode(req.params.code);
    return success(res, location);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const location = await warehouseLocationService.create(req.body, req.user, req);
    return created(res, location);
  } catch (error) {
    next(error);
  }
};

exports.createShelf = async (req, res, next) => {
  try {
    const result = await warehouseLocationService.createShelf(req.body, req.user, req);
    return created(res, result);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const location = await warehouseLocationService.update(
      req.params.locationId,
      req.body,
      req.user,
      req
    );
    return success(res, location);
  } catch (error) {
    next(error);
  }
};

exports.suggest = async (req, res, next) => {
  try {
    const location = await warehouseLocationService.suggestLocation(req.query.branchId, {
      room: req.query.room,
      shelf: req.query.shelf,
    });
    return success(res, location);
  } catch (error) {
    next(error);
  }
};
