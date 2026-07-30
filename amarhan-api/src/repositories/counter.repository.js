'use strict';

const BaseRepository = require('./base.repository');
const Counter = require('../models/counter.model');

class CounterRepository extends BaseRepository {
  constructor() {
    super(Counter);
  }

  /**
   * Тоолуурыг атомикаар нэгээр өсгөж, ШИНЭ утгыг буцаана.
   *
   * `upsert: true` — тоолуур байхгүй бол үүснэ, тиймээс seed шаардлагагүй.
   * `$inc` нь MongoDB-д атомик тул зэрэг дуудлага ялгаатай тоо авна.
   *
   * @param {string} key
   * @param {{ session?: import('mongoose').ClientSession }} [options]
   * @returns {Promise<number>}
   */
  async next(key, { session } = {}) {
    const doc = await this.model.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, ...(session ? { session } : {}) }
    );
    return doc.seq;
  }
}

module.exports = new CounterRepository();
