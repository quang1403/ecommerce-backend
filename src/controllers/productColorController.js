// src/controllers/productColorController.js
const Product = require("../models/Product");

exports.getProductColors = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).select("color name");
    if (!product) {
      return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
    }
    res.json({ productId, name: product.name, colors: product.color || [] });
  } catch (err) {
    console.error("Lỗi lấy màu sắc sản phẩm:", err);
    res.status(500).json({ error: "Lỗi lấy màu sắc sản phẩm", details: err });
  }
};
