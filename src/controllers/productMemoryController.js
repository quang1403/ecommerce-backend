// src/controllers/productMemoryController.js
const Product = require("../models/Product");

exports.getProductMemory = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).select("memory name");
    if (!product) {
      return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
    }
    res.json({ productId, name: product.name, memory: product.memory || [] });
  } catch (err) {
    console.error("Lỗi lấy bộ nhớ sản phẩm:", err);
    res.status(500).json({ error: "Lỗi lấy bộ nhớ sản phẩm", details: err });
  }
};
