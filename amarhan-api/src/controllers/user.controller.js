'use strict';

const userService = require('../services/user.service');
const { success, created } = require('../utils/response');

exports.list = async (req, res, next) => {
  try {
    const result = await userService.list(req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.userId);
    return success(res, user);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const user = await userService.create(req.body, req.user, req);
    return created(res, user);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const user = await userService.update(req.params.userId, req.body, req.user, req);
    return success(res, user);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await userService.remove(req.params.userId, req.user._id.toString());
    return success(res, { message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
