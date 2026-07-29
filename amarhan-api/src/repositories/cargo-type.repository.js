'use strict';

const BaseRepository = require('./base.repository');
const CargoType = require('../models/cargo-type.model');

class CargoTypeRepository extends BaseRepository {
  constructor() {
    super(CargoType);
  }

  async findByCode(code) {
    return this.model.findOne({ code: String(code).toLowerCase() });
  }

  async listActive() {
    return this.model.find({ isActive: true }).sort({ name: 1 });
  }

  async search(query = {}, options = {}) {
    const { page = 1, limit = 50, search, isActive } = options;
    const filter = { ...query };

    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }
    if (isActive !== undefined) filter.isActive = isActive;

    return this.paginate(filter, { page, limit, sort: { name: 1 } });
  }
}

module.exports = new CargoTypeRepository();
