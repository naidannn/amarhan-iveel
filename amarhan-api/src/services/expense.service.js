'use strict';

const httpStatus = require('http-status');
const expenseRepository = require('../repositories/expense.repository');
const branchResolver = require('./branch-resolver.service');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const { AUDIT_ACTION, AUDIT_ENTITY, ERROR_CODE, EXPENSE_CATEGORY, EXPENSE_STATUS, ROLES } = require('../config/constants');

/**
 * Зарлагын модуль — BR-47.
 *
 * Менежер/Админ л хандана (route түвшинд хаагдсан). Ажилтан огт хандахгүй.
 * Буруу бүртгэсэн зарлагыг ХЭЗЭЭ Ч устгахгүй, зөвхөн `voided` болгоно —
 * `payment.service.js`-ийн `void()`-той ижил зарчим (BR-18).
 */
class ExpenseService {
  async list(options, actor) {
    const scoped = await this.applyBranchScope(options, actor);
    const result = await expenseRepository.search({}, scoped);
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

  async summary(options, actor) {
    const scoped = await this.applyBranchScope(options, actor);
    return expenseRepository.summary(scoped);
  }

  async getById(id) {
    const expense = await expenseRepository.findById(id);
    if (!expense) {
      throw new APIError('Зарлага олдсонгүй', httpStatus.NOT_FOUND);
    }
    return expense;
  }

  async create(data, actor, req) {
    const branch = await branchResolver.resolveBranch(data.branchId ?? actor?.branchId ?? null);

    const doc = {
      amount: data.amount,
      category: data.category,
      categoryLabel: data.category === EXPENSE_CATEGORY.OTHER ? String(data.categoryLabel).trim() : null,
      description: String(data.description).trim(),
      date: data.date ? new Date(data.date) : new Date(),
      branchId: branch._id,
      status: EXPENSE_STATUS.ACTIVE,
      createdBy: actor?._id ?? null,
      createdByName: auditService.describeActor(actor),
    };

    return withTransaction(async session => {
      const expense = await expenseRepository.createWithSession(doc, { session });

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.EXPENSE_CREATE,
          entity: AUDIT_ENTITY.EXPENSE,
          entityId: expense._id,
          entityLabel: expense.description,
          branchId: branch._id,
          field: 'amount',
          before: null,
          after: expense.amount,
          reason: expense.description,
          req,
        },
        { session }
      );

      return expense;
    });
  }

  async void(id, { reason }, actor, req) {
    const expense = await this.getById(id);

    if (expense.status === EXPENSE_STATUS.VOIDED) {
      throw new APIError('Зарлага аль хэдийн хүчингүй болсон', httpStatus.UNPROCESSABLE_ENTITY, {
        code: ERROR_CODE.EXPENSE_ALREADY_VOIDED,
      });
    }

    const voidReason = String(reason ?? '').trim();
    if (voidReason.length < 3) {
      throw new APIError('Хүчингүй болгох шалтгааныг бичнэ үү', httpStatus.BAD_REQUEST);
    }

    return withTransaction(async session => {
      const updated = await expenseRepository.updateByIdWithSession(
        id,
        {
          status: EXPENSE_STATUS.VOIDED,
          voidedAt: new Date(),
          voidedBy: actor?._id ?? null,
          voidReason,
        },
        { session }
      );

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.EXPENSE_VOID,
          entity: AUDIT_ENTITY.EXPENSE,
          entityId: updated._id,
          entityLabel: updated.description,
          branchId: updated.branchId,
          field: 'status',
          before: expense.status,
          after: EXPENSE_STATUS.VOIDED,
          reason: voidReason,
          req,
        },
        { session }
      );

      return updated;
    });
  }

  /**
   * §9.1 — Админ бүх салбар, Менежер зөвхөн өөрийн салбар (BR-37-ийн ижил зарчим).
   */
  async applyBranchScope(options, actor) {
    if (!actor || actor.role === ROLES.ADMIN) return options;
    if (actor.branchId) return { ...options, branchId: actor.branchId };

    const branch = await branchResolver.resolveBranch();
    return { ...options, branchId: branch._id };
  }
}

module.exports = new ExpenseService();
