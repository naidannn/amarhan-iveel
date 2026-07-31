'use strict';

const httpStatus = require('http-status');
const userRepository = require('../repositories/user.repository');
const branchResolver = require('./branch-resolver.service');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../config/constants');

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
  async create(data, actor, req) {
    try {
      const payload = { ...data };
      if (payload.branchId == null) {
        payload.branchId = await branchResolver.getDefaultBranchId();
      }

      return withTransaction(async session => {
        const [user] = await userRepository.model.create([payload], { session });

        await auditService.record(
          {
            actor,
            action: AUDIT_ACTION.USER_CREATE,
            entity: AUDIT_ENTITY.USER,
            entityId: user._id,
            entityLabel: `${user.lastname} ${user.firstname}`.trim() || user.email,
            after: this.publicFields(user),
            req,
          },
          { session }
        );

        return this.publicFields(user);
      });
    } catch (error) {
      if (error.code === 11000) {
        throw new APIError('Email already exists', httpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async update(id, data, actor, req) {
    const existing = await this.getById(id);
    const patch = { ...data };
    // Don't allow password update through this method
    delete patch.password;

    const changes = {};
    for (const field of ['email', 'firstname', 'lastname', 'role', 'status', 'branchId']) {
      if (patch[field] !== undefined && String(patch[field]) !== String(existing[field])) {
        changes[field] = { before: existing[field], after: patch[field] };
      }
    }

    try {
      return await withTransaction(async session => {
        const user = await userRepository.model.findByIdAndUpdate(id, patch, {
          new: true,
          runValidators: true,
          session,
        });

        if (!user) throw new APIError('User not found', httpStatus.NOT_FOUND);

        const auditBase = {
          actor,
          entity: AUDIT_ENTITY.USER,
          entityId: user._id,
          entityLabel: `${user.lastname} ${user.firstname}`.trim() || user.email,
          req,
        };

        const updateChanges = { ...changes };
        delete updateChanges.role;
        delete updateChanges.status;
        await auditService.recordChanges(
          { ...auditBase, action: AUDIT_ACTION.USER_UPDATE },
          updateChanges,
          { session }
        );
        if (changes.role) {
          await auditService.recordChanges(
            { ...auditBase, action: AUDIT_ACTION.USER_ROLE_CHANGE },
            { role: changes.role },
            { session }
          );
        }
        if (changes.status) {
          await auditService.recordChanges(
            {
              ...auditBase,
              action:
                patch.status === 'deactive' ? AUDIT_ACTION.USER_DISABLE : AUDIT_ACTION.USER_UPDATE,
            },
            { status: changes.status },
            { session }
          );
        }

        return this.publicFields(user);
      });
    } catch (error) {
      if (error.code === 11000) {
        throw new APIError('Email already exists', httpStatus.CONFLICT);
      }
      throw error;
    }
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

  publicFields(user) {
    const value = user.toJSON ? user.toJSON() : { ...user };
    delete value.password;
    return value;
  }
}

module.exports = new UserService();
