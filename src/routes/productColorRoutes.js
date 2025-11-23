// src/routes/productColorRoutes.js
const express = require("express");
const router = express.Router();
const productColorController = require("../controllers/productColorController");

// Lấy danh sách màu sắc của sản phẩm
router.get("/:id/colors", productColorController.getProductColors);

module.exports = router;
