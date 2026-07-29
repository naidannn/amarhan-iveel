'use strict';

const httpStatus = require('http-status');
const branchRepository = require('../repositories/branch.repository');
const APIError = require('../utils/APIError');

/**
 * Салбарыг тодорхойлох дүрэм — introduction.md §8
 *
 * НЭГ САЛБАРЫН ГОРИМ. Ивээл Карго одоогоор ганц салбартай тул ажилтан бүрт
 * салбар сонгуулах нь илүүц алхам. Идэвхтэй салбар ЯГ НЭГ байвал автоматаар
 * сонгогдоно.
 *
 * ТУСДАА ФАЙЛ БАЙГААГИЙН ШАЛТГААН: `audit.service` салбарын хамрах хүрээг
 * тодорхойлохын тулд энэ дүрмийг хэрэглэдэг бол `branch.service` нь өөрчлөлт
 * бүрийг audit-д бичдэг. Хоёуланг нэг файлд байрлуулбал дугуй хамаарал
 * (circular dependency) үүсэж, Node модулийг хагас ачаалагдсан үед буцаана.
 */
class BranchResolverService {
  /**
   * @param {string|null} [explicitId] — хүсэлтэд заасан салбар (байвал шалгана)
   * @returns {Promise<import('mongoose').Document>}
   * @throws {APIError} салбар байхгүй, олдсонгүй, эсвэл олон байвал
   */
  async resolveBranch(explicitId = null) {
    if (explicitId) {
      const branch = await branchRepository.findById(explicitId);
      if (!branch) {
        throw new APIError('Салбар олдсонгүй', httpStatus.NOT_FOUND);
      }
      return branch;
    }

    const active = await branchRepository.listActive();

    if (active.length === 0) {
      throw new APIError(
        'Салбар бүртгэгдээгүй байна. Эхлээд салбар үүсгэнэ үү',
        httpStatus.UNPROCESSABLE_ENTITY
      );
    }

    // Салбар нэмэгдмэгц дуудагч салбараа тодорхой заахыг шаардана — өгөгдөл
    // чимээгүй буруу салбарт бүртгэгдэхээс сэргийлнэ.
    if (active.length > 1) {
      throw new APIError(
        'Салбар олон байна — аль салбарт хамаарахыг заана уу',
        httpStatus.BAD_REQUEST
      );
    }

    return active[0];
  }

  /**
   * Анхдагч салбарын ID. Салбар байхгүй эсвэл нэгээс олон бол `null`.
   * Заавал биш газарт (ажилтан үүсгэх) хэрэглэнэ — алдаа шидэхгүй.
   */
  async getDefaultBranchId() {
    const active = await branchRepository.listActive();
    return active.length === 1 ? active[0]._id : null;
  }
}

module.exports = new BranchResolverService();
