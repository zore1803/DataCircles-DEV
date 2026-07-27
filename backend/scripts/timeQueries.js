require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Company = require('../models/Company');
const Contact = require('../models/Contact');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const org = "6a5703d82dd9d4270cc7ee59";

  for (const [label, run] of [
    ["Company.find(org).limit(50)", () => Company.find({ organization: org }).sort({ name: 1 }).skip(0).limit(50)],
    ["Company.countDocuments(org)", () => Company.countDocuments({ organization: org })],
    ["Contact.find(org).populate(company).limit(50)", () => Contact.find({ organization: org }).populate("company").sort({ name: 1 }).skip(0).limit(50)],
    ["Contact.countDocuments(org)", () => Contact.countDocuments({ organization: org })],
  ]) {
    const times = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      await run();
      times.push(Date.now() - t0);
    }
    console.log(label, "->", times, "ms  avg:", (times.reduce((a,b)=>a+b,0)/times.length).toFixed(1));
  }
  process.exit(0);
})();
