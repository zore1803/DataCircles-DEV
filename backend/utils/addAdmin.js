const User = require("../models/User");

const addAdmin = async (name, email, password) => {
  const userExist = await User.findOne({ email });

  if (userExist) {
    console.log("Admin already exist");
    return;
  }
  const user = new User({ name, email, password, role: "admin" });
  await user.save();
  console.log("Admin registered");
};

addAdmin(process.argv[2],process.argv[3],process.argv[4]);
