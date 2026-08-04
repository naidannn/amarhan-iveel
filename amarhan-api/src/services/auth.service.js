'use strict';

const jwt = require('jsonwebtoken');
const httpStatus = require('http-status');
const config = require('../config');
const userRepository = require('../repositories/user.repository');
const auditService = require('./audit.service');
const emailService = require('./email.service');
const APIError = require('../utils/APIError');
const resetToken = require('../utils/reset-token');
const { passwordResetEmail } = require('../utils/email-templates');
const { AUDIT_ACTION, AUDIT_ENTITY, ERROR_CODE } = require('../config/constants');

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

  /**
   * Нууц үг сэргээх холбоос имэйлээр илгээнэ.
   *
   * Хэрэглэгч олдсон эсэхээс үл хамааран ЯГ АДИЛ хариу буцаана — эсрэг
   * тохиолдолд аль имэйл системд бүртгэлтэйг тааварлах боломж (user
   * enumeration) нээгдэнэ.
   */
  async forgotPassword(email) {
    const user = await userRepository.findByEmail(email);

    if (user && user.status === 'active') {
      const { token, hash, expires } = resetToken.generate();
      user.resetPasswordTokenHash = hash;
      user.resetPasswordExpires = expires;
      await user.save({ validateBeforeSave: false });

      const resetUrl = `${config.server.frontendURL}/admin/reset-password?token=${token}`;
      await emailService.send({
        to: user.email,
        subject: 'Нууц үг сэргээх — Ивээл Карго',
        html: passwordResetEmail({ resetUrl, expiresInMinutes: resetToken.TTL_MS / 60000 }),
      });

      await auditService.record({
        action: AUDIT_ACTION.USER_PASSWORD_RESET_REQUEST,
        entity: AUDIT_ENTITY.USER,
        entityId: user._id,
        entityLabel: user.email,
        actorName: `${user.firstname} ${user.lastname}`.trim() || user.email,
      });
    }

    return true;
  }

  async resetPassword({ token, newPassword }) {
    const user = await userRepository.findByResetTokenHash(resetToken.hash(token));
    if (!user) {
      throw new APIError('Холбоосны хугацаа дууссан эсвэл буруу байна', httpStatus.BAD_REQUEST, {
        code: ERROR_CODE.INVALID_RESET_TOKEN,
      });
    }

    user.password = newPassword;
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();

    await auditService.record({
      action: AUDIT_ACTION.USER_PASSWORD_RESET,
      entity: AUDIT_ENTITY.USER,
      entityId: user._id,
      entityLabel: user.email,
      actorName: `${user.firstname} ${user.lastname}`.trim() || user.email,
    });

    return true;
  }
}

module.exports = new AuthService();
