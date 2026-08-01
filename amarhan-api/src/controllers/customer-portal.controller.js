'use strict';

const customerPortalService = require('../services/customer-portal.service');
const { success, created } = require('../utils/response');

/**
 * Бүх метод `req.customer._id`-г хамрах хүрээ болгон дамжуулна.
 * Клиентээс ирсэн ямар ч ID/утас хамрах хүрээг тодорхойлохгүй.
 */

exports.summary = async (req, res, next) => {
  try {
    return success(res, await customerPortalService.summary(req.customer._id));
  } catch (error) {
    next(error);
  }
};

exports.listPackages = async (req, res, next) => {
  try {
    const result = await customerPortalService.listPackages(req.customer._id, req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getPackage = async (req, res, next) => {
  try {
    const pkg = await customerPortalService.getPackage(req.customer._id, req.params.packageId);
    return success(res, pkg);
  } catch (error) {
    next(error);
  }
};

/**
 * BR-46 — өөрөө ачаа бүртгүүлэх. `req.customer` (токеноос гарсан баримт)
 * бүтнээр дамжина: утас нь ачааг холбох түлхүүр (BR-26) тул body-гоос
 * ХЭЗЭЭ Ч авахгүй (дүрэм 13, 14).
 */
exports.registerPackage = async (req, res, next) => {
  try {
    const pkg = await customerPortalService.registerPackage(req.customer, req.body, req);
    return created(res, pkg);
  } catch (error) {
    next(error);
  }
};

exports.cancelPackage = async (req, res, next) => {
  try {
    const pkg = await customerPortalService.cancelPackage(req.customer, req.params.packageId, req);
    return success(res, pkg);
  } catch (error) {
    next(error);
  }
};

exports.listPayments = async (req, res, next) => {
  try {
    const result = await customerPortalService.listPayments(req.customer._id, req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.listInvoices = async (req, res, next) => {
  try {
    const result = await customerPortalService.listInvoices(req.customer._id, req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.listDeliveries = async (req, res, next) => {
  try {
    const result = await customerPortalService.listDeliveries(req.customer._id, req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/** Roadmap 5.8 — захиалж болох ачаа + дүн + дансны мэдээлэл */
exports.deliverableForDelivery = async (req, res, next) => {
  try {
    const result = await customerPortalService.deliverableForDelivery(req.customer);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.createDelivery = async (req, res, next) => {
  try {
    const result = await customerPortalService.createDelivery(req.customer, req.body, req);
    return created(res, result);
  } catch (error) {
    next(error);
  }
};
