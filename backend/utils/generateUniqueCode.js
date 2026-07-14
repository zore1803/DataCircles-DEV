// utils/generateUniqueCode.js
const Organization = require('../models/Organization');

async function generateUniqueCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 10).toUpperCase();
  } while (await Organization.findOne({ code }));
  return code;
}

module.exports = generateUniqueCode;