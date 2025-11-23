const mongoose = require("mongoose");
const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  image: String,
  author: String,
  publishedDate: { type: Date, default: Date.now },
  source: String,
  tags: [String],
  featured: { type: Boolean, default: false },
});
module.exports = mongoose.model("News", NewsSchema);
