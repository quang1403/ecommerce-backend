// src/routes/analyticsRoutes.js
const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { auth, isAdmin } = require("../middleware/auth");

// Phân tích doanh thu theo thời gian tùy chỉnh
router.get("/revenue", auth, isAdmin, analyticsController.getRevenueAnalytics);

// Phân tích hành vi khách hàng
router.get(
  "/customers",
  auth,
  isAdmin,
  analyticsController.getCustomerAnalytics
);

// Phân tích sản phẩm chi tiết
router.get("/products", auth, isAdmin, analyticsController.getProductAnalytics);

// Phân tích xu hướng và dự đoán
router.get("/trends", auth, isAdmin, analyticsController.getTrendAnalytics);

// Báo cáo tổng hợp
router.get(
  "/report",
  auth,
  isAdmin,
  analyticsController.getComprehensiveReport
);

module.exports = router;
