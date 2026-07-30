'use strict';

const customerPortalService = require('../services/customer-portal.service');
const { success } = require('../utils/response');

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
