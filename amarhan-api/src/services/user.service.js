'use strict';

const httpStatus = require('http-status');
const userRepository = require('../repositories/user.repository');
const branchResolver = require('./branch-resolver.service');
const APIError = require('../utils/APIError');

class UserService {
  async list(options) {
    const result = await userRepository.search({}, options);
    return {
      data: result.docs,
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
      },
    };
  }

  async getById(id) {
    const user = await userRepository.findByIdWithoutPassword(id);
    if (!user) {
      throw new APIError('User not found', httpStatus.NOT_FOUND);
    }
    return user;
  }

  /**
   * НЭГ САЛБАРЫН ГОРИМ: салбар заагаагүй бол цорын ганц идэвхтэй салбарыг
   * автоматаар ононо. Ингэснээр админ ажилтан үүсгэхдээ салбар сонгох алхам
   * гарахгүй, мөн салбаргүй ажилтан үүсэхээс сэргийлнэ (Менежерийн audit
   * хамрах хүрээ салбараас хамаардаг).
   */
  async create(data) {
    try {
      const payload = { ...data };
      if (payload.branchId == null) {
        payload.branchId = await branchResolver.getDefaultBranchId();
      }

      const user = await userRepository.create(payload);
      const userObj = user.toObject();
      delete userObj.password;
      return userObj;
    } catch (error) {
      if (error.code === 11000) {
        throw new APIError('Email already exists', httpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async update(id, data) {
    // Don't allow password update through this method
    delete data.password;

    const user = await userRepository.updateById(id, data);
    if (!user) {
      throw new APIError('User not found', httpStatus.NOT_FOUND);
    }

    const userObj = user.toObject();
    delete userObj.password;
    return userObj;
  }

  async remove(id, requestingUserId) {
    if (id === requestingUserId) {
      throw new APIError('Cannot delete your own account', httpStatus.BAD_REQUEST);
    }

    const user = await userRepository.deleteById(id);
    if (!user) {
      throw new APIError('User not found', httpStatus.NOT_FOUND);
    }
    return true;
  }
}

module.exports = new UserService();
