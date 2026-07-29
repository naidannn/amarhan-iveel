'use strict';

const httpStatus = require('http-status');
const branchRepository = require('../repositories/branch.repository');
const branchResolver = require('./branch-resolver.service');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../config/constants');

class BranchService {
  async list(options) {
    const result = await branchRepository.search({}, options);
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

  async listActive() {
    return branchRepository.listActive();
  }

  async getById(id) {
    const branch = await branchRepository.findById(id);
    if (!branch) {
      throw new APIError('Салбар олдсонгүй', httpStatus.NOT_FOUND);
    }
    return branch;
  }

  /**
   * Салбарыг тодорхойлох дүрэм `branch-resolver.service.js`-д байрлана
   * (дугуй хамаарлаас сэргийлэх үүднээс). Эндээс дамжуулан хүргэнэ.
   */
  resolveBranch(explicitId = null) {
    return branchResolver.resolveBranch(explicitId);
  }

  getDefaultBranchId() {
    return branchResolver.getDefaultBranchId();
  }

  async create(data, actor, req) {
    const existing = await branchRepository.findByCode(data.code);
    if (existing) {
      throw new APIError(
        `"${data.code}" кодтой салбар аль хэдийн бүртгэгдсэн`,
        httpStatus.CONFLICT
      );
    }

    return withTransaction(async session => {
      const [branch] = await branchRepository.model.create([data], { session });

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.BRANCH_CREATE,
          entity: AUDIT_ENTITY.BRANCH,
          entityId: branch._id,
          entityLabel: branch.code,
          after: branch.toJSON(),
          req,
        },
        { session }
      );

      return branch;
    });
  }

  async update(id, data, actor, req) {
    const branch = await this.getById(id);

    // Салбарын код нь байршлын кодын нэг хэсэг — өөрчилвөл бүх байршлын код
    // буруу болно. Тиймээс өөрчлөхийг хориглоно.
    if (data.code && data.code.toUpperCase() !== branch.code) {
      throw new APIError(
        'Салбарын кодыг өөрчлөх боломжгүй — байршлын кодууд түүнээс хамаардаг',
        httpStatus.UNPROCESSABLE_ENTITY
      );
    }

    const changes = {};
    const trackedFields = ['name', 'country', 'address', 'phone', 'receiverName', 'isActive'];
    for (const field of trackedFields) {
      if (data[field] !== undefined && String(data[field]) !== String(branch[field])) {
        changes[field] = { before: branch[field], after: data[field] };
      }
    }

    return withTransaction(async session => {
      const updated = await branchRepository.model.findByIdAndUpdate(
        id,
        { ...data, code: branch.code },
        { new: true, runValidators: true, session }
      );

      await auditService.recordChanges(
        {
          actor,
          action: AUDIT_ACTION.BRANCH_UPDATE,
          entity: AUDIT_ENTITY.BRANCH,
          entityId: updated._id,
          entityLabel: updated.code,
          req,
        },
        changes,
        { session }
      );

      return updated;
    });
  }
}

module.exports = new BranchService();
