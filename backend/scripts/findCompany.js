require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Company = require('../models/Company');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const c = await Company.findOne({ name: process.argv[2] || "Amber Collective 143" });
  console.log(JSON.stringify(c, null, 2));
  process.exit(0);
})();
