'use strict';

const paymentService = require('../services/payment.service');
const logger = require('../utils/logger');

/**
 * QPay webhook — танилтгүй, `payment.route.js`-ийн ажилтны `authorize()`-аас
 * ЗОРИУДААР тусдаа (`qpay.route.js`). Payload-д ИТГЭХГҮЙ — бодит
 * баталгаажуулалт (`qpayService.checkInvoice`-аар өөрийн эрхээр дахин
 * шалгах) `payment.service.js#handleQpayCallback` дотор.
 *
 * Амжилттай/давхардсан/тохирох бичлэг олдоогүй БҮХ тохиолдолд `200 OK`
 * буцаана (QPay-ийн дахин илгээхээс сэргийлнэ) — зөвхөн гэнэтийн серверийн
 * алдаанд 5xx (QPay дахин оролдоно, архитектур §4.4).
 */
exports.callback = async (req, res) => {
  const paymentId = req.query.paymentId || req.body?.paymentId;

  if (!paymentId) {
    return res.status(200).json({ success: true });
  }

  try {
    await paymentService.handleQpayCallback(paymentId);
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('QPay callback боловсруулахад алдаа гарлаа', {
      paymentId,
      error: error.message,
    });
    return res.status(500).json({ success: false });
  }
};
