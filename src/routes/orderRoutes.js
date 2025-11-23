// Tra cứu bảo hành theo token user
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { auth, isAdmin } = require("../middleware/auth");

// Admin: lấy tất cả đơn hàng
router.get("/admin/all", auth, isAdmin, orderController.getAllOrders);
// Admin: lấy danh sách đơn hàng trả góp
router.get(
  "/admin/installments",
  auth,
  isAdmin,
  orderController.getInstallmentOrders
);
// Admin: cập nhật trạng thái trả góp
router.put(
  "/admin/:id/installment-status",
  auth,
  isAdmin,
  orderController.updateInstallmentStatus
);
// Admin: xóa đơn hàng
router.delete("/admin/:id", auth, isAdmin, orderController.deleteOrder);
// Admin: cập nhật trạng thái đơn hàng
router.put(
  "/admin/:id/status",
  auth,
  isAdmin,
  orderController.updateOrderStatus
);
router.get("/warranty/lookup", auth, orderController.lookupWarranty);

// Tạo đơn hàng mới
router.post("/", auth, orderController.createOrder);
// Lấy danh sách đơn hàng của user
router.get("/", auth, orderController.getOrdersByCustomer);
// Cập nhật trạng thái đơn hàng
router.put("/status", auth, orderController.updateOrderStatus);
router.delete("/:id", auth, orderController.deleteOrder);
module.exports = router;
