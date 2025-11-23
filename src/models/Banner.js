const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: String,
    image: String,
    link: String,
    position: { type: String, enum: ["top", "middle", "bottom"], default: "top" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
