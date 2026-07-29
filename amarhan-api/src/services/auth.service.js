'use strict';

const jwt = require('jsonwebtoken');
const httpStatus = require('http-status');
const config = require('../config');
const userRepository = require('../repositories/user.repository');
const APIError = require('../utils/APIError');

class AuthService {
  generateToken(user) {
    const payload = { sub: user.id };
    return jwt.sign(payload, config.secret);
  }

  async register(data) {
    try {
      const user = await userRepository.create(data);
      const userObj = user.toObject();
      delete userObj.password;
      return userObj;
    } catch (error) {
      if (error.code === 11000) {
        throw new APIError('Email already taken', httpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async login({ email, password }) {
    if (!email) {
      throw new APIError('Email must be provided', httpStatus.BAD_REQUEST);
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new APIError('Invalid email or password', httpStatus.UNAUTHORIZED);
    }

    const passwordMatch = user.passwordMatches(password);
    if (!passwordMatch) {
      throw new APIError('Invalid email or password', httpStatus.UNAUTHORIZED);
    }

    const token = this.generateToken(user);
    const userObj = user.toObject();
    delete userObj.password;

    return { token, user: userObj };
  }

  async getMe(userId) {
    const user = await userRepository.findByIdWithoutPassword(userId);
    if (!user) {
      throw new APIError('User not found', httpStatus.NOT_FOUND);
    }
    return user;
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new APIError('User not found', httpStatus.NOT_FOUND);
    }

    const isMatch = user.passwordMatches(currentPassword);
    if (!isMatch) {
      throw new APIError('Current password is incorrect', httpStatus.BAD_REQUEST);
    }

    user.password = newPassword;
    await user.save();
    return true;
  }
}

module.exports = new AuthService();
