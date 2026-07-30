'use strict';

const deliveryService = require('../services/delivery.service');
const { success, created } = require('../utils/response');

exports.list = async (req, res, next) => {
  try {
    const result = await deliveryService.list(req.query, req.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.summary = async (req, res, next) => {
  try {
    const result = await deliveryService.summary(req.query, req.user);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const detail = await deliveryService.getDetail(req.params.deliveryId);
    return success(res, detail);
  } catch (error) {
    next(error);
  }
};

exports.listForPackage = async (req, res, next) => {
  try {
    const deliveries = await deliveryService.listForPackage(req.params.packageId);
    return success(res, deliveries);
  } catch (error) {
    next(error);
  }
};

exports.deliverableByPhone = async (req, res, next) => {
  try {
    const result = await deliveryService.deliverableByPhone(req.params.phone);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const delivery = await deliveryService.create(req.body, req.user, req);
    return created(res, delivery);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const delivery = await deliveryService.update(req.params.deliveryId, req.body, req.user, req);
    return success(res, delivery);
  } catch (error) {
    next(error);
  }
};

exports.changeStatus = async (req, res, next) => {
  try {
    const delivery = await deliveryService.changeStatus(
      req.params.deliveryId,
      req.body.status,
      { reason: req.body.reason },
      req.user,
      req
    );
    return success(res, delivery);
  } catch (error) {
    next(error);
  }
};

exports.changeStatusBulk = async (req, res, next) => {
  try {
    const result = await deliveryService.changeStatusBulk(
      req.body.ids,
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
    const delivery = await deliveryService.cancel(
      req.params.deliveryId,
      { reason: req.body.reason },
      req.user,
      req
    );
    return success(res, delivery);
  } catch (error) {
    next(error);
  }
};
