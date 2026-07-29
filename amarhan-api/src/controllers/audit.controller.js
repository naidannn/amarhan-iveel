'use strict';

const auditService = require('../services/audit.service');

/**
 * §9.1 — Audit Log-ийг Админ бүх салбараар, Менежер зөвхөн өөрийн салбараар
 * харна. Ажилтан огт харахгүй (route түвшинд хаагдсан).
 */
exports.list = async (req, res, next) => {
  try {
    const result = await auditService.list(req.query, req.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
