// src/routes/productVariantRoutes.js
const express = require("express");
const router = express.Router();
const productVariantController = require("../controllers/productVariantController");

// Lấy danh sách các lựa chọn cấu hình của sản phẩm
router.get("/:id/variants", productVariantController.getProductVariants);

module.exports = router;
