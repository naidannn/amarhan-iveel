'use strict';

const notificationService = require('../services/notification.service');
const { success, created } = require('../utils/response');

// ── Ажилтан (§7, BR-36 — Админ/Менежер) ────────────────────────────────────

exports.send = async (req, res, next) => {
  try {
    const doc = await notificationService.sendBroadcast(req.body, req.user, req);
    return created(res, doc);
  } catch (error) {
    next(error);
  }
};

exports.list = async (req, res, next) => {
  try {
    const result = await notificationService.listSent(req.query, req.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// ── Нэвтрээгүй зочин (§7, roadmap 6.3) ─────────────────────────────────────

exports.listPublic = async (req, res, next) => {
  try {
    const result = await notificationService.listPublic(req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// ── Харилцагч (`req.customer._id`-ээс хамрах хүрээ, дүрэм 14) ─────────────

exports.listMine = async (req, res, next) => {
  try {
    const result = await notificationService.listForCustomer(req.customer._id, req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.unreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.unreadCount(req.customer._id);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const result = await notificationService.markRead(req.customer._id, req.params.id);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllRead(req.customer._id);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};
