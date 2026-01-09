// Lấy profile user theo token

const express = require("express");
const router = express.Router();
const passport = require("passport");
const { auth, isAdmin } = require("../middleware/auth");
const userController = require("../controllers/userController");

// Google OAuth Routes
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/users/auth/google/failure",
    session: false,
  }),
  userController.googleAuthSuccess
);

router.get("/auth/google/failure", userController.googleAuthFailure);

// Địa chỉ nhiều địa chỉ cho user
router.post("/address", auth, userController.addAddress); // Thêm địa chỉ mới
router.get("/address", auth, userController.getAddresses); // Lấy danh sách địa chỉ
router.put("/address/:addressId", auth, userController.updateAddress); // Sửa địa chỉ
router.delete("/address/:addressId", auth, userController.deleteAddress); // Xóa địa chỉ
router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/logout", userController.logout);
router.get("/", userController.getAllUsers);
router.put("/change-password", auth, userController.changePassword);
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password", userController.resetPassword);
router.get("/me", auth, userController.getProfile);

router.get("/:id", userController.getUserById);
router.put("/:id", auth, userController.updateUser); // cập nhập user
router.delete("/:id", userController.deleteUser);
// Khóa/mở tài khoản user (admin)
router.put("/:id/toggle-active", auth, userController.toggleActiveUser);
module.exports = router;
