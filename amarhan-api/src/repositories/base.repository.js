'use strict';

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id, select = '') {
    return this.model.findById(id).select(select);
  }

  async findOne(query, select = '') {
    return this.model.findOne(query).select(select);
  }

  async find(query = {}, options = {}) {
    const { select = '', sort = { createdAt: -1 }, limit, skip } = options;
    let q = this.model.find(query).select(select).sort(sort);
    if (skip) q = q.skip(skip);
    if (limit) q = q.limit(limit);
    return q;
  }

  async paginate(query = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 }, select = '' } = options;
    return this.model.paginate(query, { page, limit, sort, select });
  }

  async create(data) {
    const doc = new this.model(data);
    return doc.save();
  }

  async updateById(id, data, options = { new: true, runValidators: true }) {
    return this.model.findByIdAndUpdate(id, data, options);
  }

  async deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }

  async count(query = {}) {
    return this.model.countDocuments(query);
  }
}

module.exports = BaseRepository;
