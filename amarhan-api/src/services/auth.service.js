'use strict';

const jwt = require('jsonwebtoken');
const httpStatus = require('http-status');
const config = require('../config');
const userRepository = require('../repositories/user.repository');
const APIError = require('../utils/APIError');

class AuthService {
  /**
   * Ажилтны токен үүсгэнэ.
   *
   * `aud: 'staff'` — харилцагчийн токеноос ялгах зорилготой. Phase 5-д нэмэгдэх
   * харилцагчийн токен `aud: 'customer'` байх бөгөөд хоорондоо солигдох боломжгүй.
   */
  generateToken(user) {
    const payload = {
      sub: user.id,
      role: user.role,
      branchId: user.branchId ? user.branchId.toString() : null,
    };
    return jwt.sign(payload, config.secret, {
      audience: config.jwt.staffAudience,
      expiresIn: config.jwt.staffExpiresIn,
    });
  }

  async login({ email, password }) {
    if (!email) {
      throw new APIError('Имэйл заавал шаардлагатай', httpStatus.BAD_REQUEST);
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new APIError('Имэйл эсвэл нууц үг буруу байна', httpStatus.UNAUTHORIZED);
    }

    const passwordMatch = user.passwordMatches(password);
    if (!passwordMatch) {
      throw new APIError('Имэйл эсвэл нууц үг буруу байна', httpStatus.UNAUTHORIZED);
    }

    if (user.status !== 'active') {
      throw new APIError('Таны бүртгэл идэвхгүй болсон байна', httpStatus.FORBIDDEN);
    }

    const token = this.generateToken(user);

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

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
