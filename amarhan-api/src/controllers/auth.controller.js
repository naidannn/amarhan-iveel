'use strict';

const authService = require('../services/auth.service');
const { success } = require('../utils/response');

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

exports.forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email);
    return success(res, {
      message: 'Хэрэв энэ имэйл бүртгэлтэй бол сэргээх холбоос илгээгдлээ',
    });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body);
    return success(res, { message: 'Нууц үг амжилттай солигдлоо' });
  } catch (error) {
    next(error);
  }
};
