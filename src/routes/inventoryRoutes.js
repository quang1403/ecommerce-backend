const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const { auth, isAdmin } = require("../middleware/auth");

// Kiểm tra tồn kho của một sản phẩm (Public)
router.get("/stock/:productId", inventoryController.checkStock);

// Cập nhật số lượng tồn kho (Admin only)
router.put("/stock/:productId", auth, isAdmin, inventoryController.updateStock);

// Lấy danh sách sản phẩm sắp hết hàng (Admin only)
router.get(
  "/low-stock",
  auth,
  isAdmin,
  inventoryController.getLowStockProducts
);

// Lấy danh sách sản phẩm hết hàng (Admin only)
router.get(
  "/out-of-stock",
  auth,
  isAdmin,
  inventoryController.getOutOfStockProducts
);

// Báo cáo tồn kho tổng quan (Admin only)
router.get("/report", auth, isAdmin, inventoryController.getInventoryReport);

// Cập nhật tồn kho hàng loạt (Admin only)
router.put("/bulk-update", auth, isAdmin, inventoryController.bulkUpdateStock);

module.exports = router;
