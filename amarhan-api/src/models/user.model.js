'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, ROLE_LIST } = require('../config/constants');
const Schema = mongoose.Schema;

const roles = ROLE_LIST;

const userSchema = new Schema(
  {
    email: {
      type: String,
      lowercase: true,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      minlength: 8,
      maxlength: 128,
      required: true,
    },
    firstname: {
      type: String,
      maxlength: 50,
      required: true,
    },
    lastname: {
      type: String,
      maxlength: 50,
      required: true,
    },
    role: {
      type: String,
      default: ROLES.STAFF,
      enum: roles,
      index: true,
    },
    // Менежерийн харах хүрээг тодорхойлно (introduction.md §9.1).
    // Админд заавал биш — бүх салбарыг хардаг.
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
    verified_token: {
      type: String,
    },
    verified_timestamp: {
      type: Date,
    },
    verified_status: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
    },
    username: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
    status: {
      type: String,
      enum: ['active', 'deactive'],
      default: 'active',
    },
    // Нууц үг сэргээх — raw токены sha256 хэш ХАДГАЛАГДАНА, raw утга ХЭЗЭЭ Ч биш
    resetPasswordTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function save(next) {
  try {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

// Remove password from JSON output
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

userSchema.method({
  transform() {
    const fields = [
      'id',
      'firstname',
      'lastname',
      'email',
      'role',
      'branchId',
      'createdAt',
      'status',
    ];
    const transformed = {};
    fields.forEach(field => {
      transformed[field] = this[field];
    });
    return transformed;
  },

  passwordMatches(password) {
    return bcrypt.compareSync(password, this.password);
  },
});

userSchema.statics = {
  roles,
};

// Add pagination plugin
userSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('User', userSchema);
