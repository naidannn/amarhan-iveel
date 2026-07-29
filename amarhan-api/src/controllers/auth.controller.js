'use strict';

const httpStatus = require('http-status');
const authService = require('../services/auth.service');
const { success, created } = require('../utils/response');

exports.register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    return created(res, user);
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user._id);
    return success(res, { user });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    return success(res, { message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user._id, req.body);
    return success(res, { message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};
