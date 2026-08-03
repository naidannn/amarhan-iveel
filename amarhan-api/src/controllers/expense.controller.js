'use strict';

const expenseService = require('../services/expense.service');
const { success, created } = require('../utils/response');

exports.list = async (req, res, next) => {
  try {
    const result = await expenseService.list(req.query, req.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.summary = async (req, res, next) => {
  try {
    const result = await expenseService.summary(req.query, req.user);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const expense = await expenseService.getById(req.params.expenseId);
    return success(res, expense);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const expense = await expenseService.create(req.body, req.user, req);
    return created(res, expense);
  } catch (error) {
    next(error);
  }
};

exports.void = async (req, res, next) => {
  try {
    const expense = await expenseService.void(
      req.params.expenseId,
      { reason: req.body.reason },
      req.user,
      req
    );
    return success(res, expense);
  } catch (error) {
    next(error);
  }
};
