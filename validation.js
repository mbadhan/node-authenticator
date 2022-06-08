const Joi = require("@hapi/joi");


// Register Validation
const registerValidation = async data => {
  const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().min(6).max(255).email().required(),
    password: Joi.string().min(8).required(),
  });

  return await schema.validate(data);
}


// Login Validation
const loginValidation = async data => {
  const schema = Joi.object({
    email: Joi.string().max(255).email().required(),
    password: Joi.string().required(),
  });

  return await schema.validate(data);
}


module.exports.registerValidation = registerValidation;
module.exports.loginValidation = loginValidation;