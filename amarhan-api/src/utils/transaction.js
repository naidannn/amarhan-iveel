'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Функцийг MongoDB транзакц дотор ажиллуулна.
 *
 * Яагаад хэрэгтэй вэ: мөнгө, төлөв, audit log-ийн өөрчлөлт бүгд ЭСВЭЛ хийгдэнэ,
 * ЭСВЭЛ огт хийгдэхгүй байх ёстой. Audit бичлэггүй үнийн өөрчлөлт, эсвэл
 * өөрчлөлтгүй audit бичлэг хоёулаа бизнесийн хувьд буруу (docs/business-rules.md BR-41).
 *
 * Хэрэглээ:
 *   const result = await withTransaction(async (session) => {
 *     await packageRepository.updateById(id, patch, { session });
 *     await auditService.record(entry, { session });
 *     return patch;
 *   });
 *
 * ЧУХАЛ: callback доторх БҮХ бичих үйлдэлд `{ session }` дамжуулна. Мартвал
 * тухайн үйлдэл транзакцаас гадуур явж, буцаах (rollback) боломжгүй болно.
 *
 * MongoDB нь replica set горимд ажиллаж байх шаардлагатай — standalone дээр
 * транзакц дэмжигдэхгүй (docker-compose.yml-д тохируулсан).
 *
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} fn
 * @param {{ maxRetries?: number }} [options]
 * @returns {Promise<T>}
 * @template T
 */
async function withTransaction(fn, options = {}) {
  const { maxRetries = 3 } = options;

  let attempt = 0;

  for (;;) {
    const session = await mongoose.startSession();
    try {
      let result;
      // withTransaction нь commit-ийн түр зуурын алдааг өөрөө дахин оролддог,
      // харин TransientTransactionError (бичлэгийн зөрчил) -ыг бид доор барина.
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } catch (error) {
      attempt += 1;

      const isTransient =
        error?.errorLabels?.includes('TransientTransactionError') ||
        error?.errorLabels?.includes('UnknownTransactionCommitResult');

      if (isTransient && attempt < maxRetries) {
        logger.warn('Транзакц түр зуурын алдаагаар дахин оролдож байна', {
          attempt,
          maxRetries,
          error: error.message,
        });
        continue;
      }

      if (isTransient) {
        logger.error('Транзакц дахин оролдлогын дараа ч амжилтгүй', {
          attempts: attempt,
          error: error.message,
        });
      }

      throw error;
    } finally {
      await session.endSession();
    }
  }
}

module.exports = { withTransaction };
