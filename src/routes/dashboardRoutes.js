// src/routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { auth, isAdmin } = require("../middleware/auth");

// Thống kê tổng quan dashboard
router.get("/stats", auth, isAdmin, dashboardController.getDashboardStats);

// Doanh thu theo tháng
router.get(
  "/revenue-by-month",
  auth,
  isAdmin,
  dashboardController.getRevenueByMonth
);

// Top sản phẩm bán chạy
router.get(
  "/top-products",
  auth,
  isAdmin,
  dashboardController.getTopSellingProducts
);

// Đơn hàng gần đây
router.get(
  "/recent-orders",
  auth,
  isAdmin,
  dashboardController.getRecentOrders
);

// Người dùng mới
router.get("/new-users", auth, isAdmin, dashboardController.getNewUsers);

module.exports = router;
