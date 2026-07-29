'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const projectTastSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    users: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UserGroup', projectTastSchema);
