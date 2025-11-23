// src/controllers/productVariantController.js
const Product = require("../models/Product");

exports.getProductVariants = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).select("variants name");
    if (!product) {
      return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
    }
    res.json({
      productId,
      name: product.name,
      variants: product.variants || [],
    });
  } catch (err) {
    console.error("Lỗi lấy variants sản phẩm:", err);
    res.status(500).json({ error: "Lỗi lấy variants sản phẩm", details: err });
  }
};
