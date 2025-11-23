const mongoose = require("mongoose");

const sliderSchema = new mongoose.Schema(
  {
    title: String,
    image: String, // link ảnh
    link: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Slider", sliderSchema);
