// src/routes/productMemoryRoutes.js
const express = require("express");
const router = express.Router();
const productMemoryController = require("../controllers/productMemoryController");

// Lấy danh sách bộ nhớ của sản phẩm
router.get("/:id/memory", productMemoryController.getProductMemory);

module.exports = router;
