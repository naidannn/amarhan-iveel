'use strict';

exports.roles = {
  admin: 'admin',
  senior_manager: 'senior_manager',
  manager: 'manager',
  user: 'user',
};

exports.ROLE_GROUP = {
  ADMIN: ['admin'],
  MANAGEMENT: ['admin', 'senior_manager'],
  STAFF: ['admin', 'senior_manager', 'manager'],
  ALL: ['admin', 'senior_manager', 'manager', 'user'],
};
