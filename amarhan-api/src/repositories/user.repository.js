'use strict';

const BaseRepository = require('./base.repository');
const User = require('../models/user.model');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email) {
    return this.model.findOne({ email });
  }

  async search(query = {}, options = {}) {
    const { page = 1, limit = 10, search, role, status } = options;
    const filter = { ...query };

    if (search) {
      filter.$or = [
        { firstname: { $regex: search, $options: 'i' } },
        { lastname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) filter.role = role;
    if (status) filter.status = status;

    return this.paginate(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      select: '-password',
    });
  }

  async findByIdWithoutPassword(id) {
    return this.model.findById(id).select('-password');
  }
}

module.exports = new UserRepository();
