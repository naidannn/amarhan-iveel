'use strict';

const paymentService = require('../services/payment.service');
const invoiceService = require('../services/invoice.service');
const { success, created } = require('../utils/response');

// ── Төлбөр (§1.8, §2.2) ───────────────────────────────────────────────────

exports.list = async (req, res, next) => {
  try {
    const result = await paymentService.list(req.query, req.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.summary = async (req, res, next) => {
  try {
    const result = await paymentService.summary(req.query, req.user);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const payment = await paymentService.getById(req.params.paymentId);
    return success(res, payment);
  } catch (error) {
    next(error);
  }
};

exports.listForPackage = async (req, res, next) => {
  try {
    const payments = await paymentService.listForPackage(req.params.packageId);
    return success(res, payments);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await paymentService.create(req.body, req.user, req);
    return created(res, result);
  } catch (error) {
    next(error);
  }
};

exports.void = async (req, res, next) => {
  try {
    const result = await paymentService.void(
      req.params.paymentId,
      { reason: req.body.reason },
      req.user,
      req
    );
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

// ── Нэгтгэсэн нэхэмжлэх (§2.3) ────────────────────────────────────────────

exports.listInvoices = async (req, res, next) => {
  try {
    const result = await invoiceService.list(req.query, req.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getInvoice = async (req, res, next) => {
  try {
    const detail = await invoiceService.getDetail(req.params.invoiceId);
    return success(res, detail);
  } catch (error) {
    next(error);
  }
};

exports.createInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.create(req.body, req.user, req);
    return created(res, invoice);
  } catch (error) {
    next(error);
  }
};

exports.cancelInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.cancel(
      req.params.invoiceId,
      { reason: req.body.reason },
      req.user,
      req
    );
    return success(res, invoice);
  } catch (error) {
    next(error);
  }
};

exports.payableByPhone = async (req, res, next) => {
  try {
    const result = await invoiceService.payableByPhone(req.params.phone);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};
