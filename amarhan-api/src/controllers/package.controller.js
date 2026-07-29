'use strict';

const packageService = require('../services/package.service');
const { success, created } = require('../utils/response');

exports.list = async (req, res, next) => {
  try {
    const result = await packageService.list(req.query, req.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const detail = await packageService.getDetail(req.params.packageId);
    return success(res, detail);
  } catch (error) {
    next(error);
  }
};

exports.getByTracking = async (req, res, next) => {
  try {
    const pkg = await packageService.getByTrackingNumber(req.params.trackingNumber);
    return success(res, pkg);
  } catch (error) {
    next(error);
  }
};

exports.listByPhone = async (req, res, next) => {
  try {
    const result = await packageService.listByCustomerPhone(req.params.phone, {
      status: req.query.status,
    });
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await packageService.create(req.body, req.user, req);
    return created(res, result);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const pkg = await packageService.update(req.params.packageId, req.body, req.user, req);
    return success(res, pkg);
  } catch (error) {
    next(error);
  }
};

exports.overridePrice = async (req, res, next) => {
  try {
    const pkg = await packageService.overridePrice(
      req.params.packageId,
      { price: req.body.price, reason: req.body.reason },
      req.user,
      req
    );
    return success(res, pkg);
  } catch (error) {
    next(error);
  }
};

exports.changeStatus = async (req, res, next) => {
  try {
    const pkg = await packageService.changeStatus(
      req.params.packageId,
      req.body.status,
      { reason: req.body.reason },
      req.user,
      req
    );
    return success(res, pkg);
  } catch (error) {
    next(error);
  }
};

exports.changeStatusBulk = async (req, res, next) => {
  try {
    const result = await packageService.changeStatusBulk(
      req.body.packageIds,
      req.body.status,
      { reason: req.body.reason },
      req.user,
      req
    );
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const pkg = await packageService.cancel(
      req.params.packageId,
      { reason: req.body.reason },
      req.user,
      req
    );
    return success(res, pkg);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await packageService.remove(
      req.params.packageId,
      { reason: req.body.reason },
      req.user,
      req
    );
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.moveLocation = async (req, res, next) => {
  try {
    const result = await packageService.moveLocation(req.params.packageId, req.body, req.user, req);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};
