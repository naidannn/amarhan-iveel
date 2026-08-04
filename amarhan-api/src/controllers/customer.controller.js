'use strict';

const customerService = require('../services/customer.service');
const auditService = require('../services/audit.service');
const { success, created } = require('../utils/response');
const { AUDIT_ENTITY } = require('../config/constants');

exports.list = async (req, res, next) => {
  try {
    const result = await customerService.list(req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const customer = await customerService.getById(req.params.customerId);
    return success(res, customer);
  } catch (error) {
    next(error);
  }
};

/**
 * BR-26 — ажилтан утас бичихэд харилцагчийг шууд олно.
 */
exports.getByPhone = async (req, res, next) => {
  try {
    const customer = await customerService.getByPhone(req.params.phone);
    return success(res, customer);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const customer = await customerService.create(req.body, req.user, req);
    return created(res, customer);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const customer = await customerService.update(req.params.customerId, req.body, req.user, req);
    return success(res, customer);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await customerService.remove(req.params.customerId, req.user, req);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.adjustLoyalty = async (req, res, next) => {
  try {
    const customer = await customerService.adjustLoyalty(
      req.params.customerId,
      req.body,
      req.user,
      req
    );
    return success(res, customer);
  } catch (error) {
    next(error);
  }
};

/**
 * Тухайн харилцагчийн бүх өөрчлөлтийн түүх (§9.2).
 */
exports.history = async (req, res, next) => {
  try {
    const logs = await auditService.listForEntity(AUDIT_ENTITY.CUSTOMER, req.params.customerId);
    return success(res, logs);
  } catch (error) {
    next(error);
  }
};
