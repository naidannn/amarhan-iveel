'use strict';

const Setting = require('../models/setting.model');
const auditService = require('./audit.service');
const { SETTING_DEFAULTS, AUDIT_ACTION, AUDIT_ENTITY } = require('../config/constants');

/**
 * Системийн тохиргоо.
 *
 * DB-д утга байхгүй бол `SETTING_DEFAULTS`-аас буцаана — систем анх суулгахад
 * тохиргоо дутуугаас болж унахгүй.
 */
class SettingService {
  async get(key) {
    const doc = await Setting.findOne({ key });
    if (doc) return doc.value;
    return SETTING_DEFAULTS[key];
  }

  async getNumber(key) {
    const value = await this.get(key);
    const n = Number(value);
    return Number.isFinite(n) ? n : Number(SETTING_DEFAULTS[key]);
  }

  async getAll() {
    const docs = await Setting.find({});
    const stored = Object.fromEntries(docs.map(d => [d.key, d.value]));
    return { ...SETTING_DEFAULTS, ...stored };
  }

  /**
   * Тохиргоо өөрчлөх — зөвхөн Админ (§9.1). Өөрчлөлт бүр audit-д (BR-38).
   */
  async set(key, value, actor, { session, req } = {}) {
    const before = await this.get(key);

    const doc = await Setting.findOneAndUpdate(
      { key },
      { key, value, updatedBy: actor?._id ?? null },
      { new: true, upsert: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) }
    );

    await auditService.record(
      {
        actor,
        action: AUDIT_ACTION.SETTINGS_UPDATE,
        entity: AUDIT_ENTITY.SETTINGS,
        entityId: doc._id,
        entityLabel: key,
        field: key,
        before,
        after: value,
        req,
      },
      { session }
    );

    return doc;
  }
}

module.exports = new SettingService();
