'use strict';

const Joi = require('joi');
const httpStatus = require('http-status');

const validate = (schema) => (req, res, next) => {
  const errors = [];

  ['params', 'query', 'body'].forEach((key) => {
    if (schema[key]) {
      const joiSchema = Joi.isSchema(schema[key])
        ? schema[key]
        : Joi.object(schema[key]);

      const { value, error } = joiSchema
        .prefs({ errors: { label: 'key' }, abortEarly: false })
        .validate(req[key]);

      if (error) {
        errors.push(
          ...error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            location: key,
          }))
        );
      } else {
        req[key] = value;
      }
    }
  });

  if (errors.length > 0) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Validation Error',
      errors,
    });
  }

  return next();
};

module.exports = validate;
