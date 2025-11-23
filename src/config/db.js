const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Kết nối thành công");
  } catch (error) {
    console.error("Thất bại", error);
    process.exit(1);
  }
};

module.exports = connectDB;
