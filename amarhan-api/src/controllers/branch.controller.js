'use strict';

const branchService = require('../services/branch.service');
const { success, created } = require('../utils/response');

exports.list = async (req, res, next) => {
  try {
    const result = await branchService.list(req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.listActive = async (req, res, next) => {
  try {
    const branches = await branchService.listActive();
    return success(res, branches);
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const branch = await branchService.getById(req.params.branchId);
    return success(res, branch);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const branch = await branchService.create(req.body, req.user, req);
    return created(res, branch);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const branch = await branchService.update(req.params.branchId, req.body, req.user, req);
    return success(res, branch);
  } catch (error) {
    next(error);
  }
};
