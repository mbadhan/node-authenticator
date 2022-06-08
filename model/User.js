const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    min: 3,
    max: 30,
  },
  email: {
    type: String,
    required: true,
    min: 6,
    max: 255,
  },
  password: {
    type: String,
    required: true,
    max: 1024,
    min: 8,
  },
  confirmed: {
    type: Boolean,
    default: false,
  },
  refreshToken: {
    type: String,
    default: "",
  },
  resetToken: {
    type: String,
    default: "",
  },
  date: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('User', userSchema);