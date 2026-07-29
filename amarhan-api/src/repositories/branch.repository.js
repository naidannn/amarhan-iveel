'use strict';

const BaseRepository = require('./base.repository');
const Branch = require('../models/branch.model');

class BranchRepository extends BaseRepository {
  constructor() {
    super(Branch);
  }

  async findByCode(code) {
    return this.model.findOne({ code: String(code).toUpperCase() });
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

    return this.paginate(filter, { page, limit, sort: { code: 1 } });
  }

  async listActive() {
    return this.model.find({ isActive: true }).sort({ code: 1 });
  }
}

module.exports = new BranchRepository();
