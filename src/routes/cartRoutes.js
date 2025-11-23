// src/routes/cartRoutes.js
const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const { auth, isAdmin } = require("../middleware/auth");

router.get("/", auth, cartController.getCartByCustomer);
router.post("/", auth, cartController.addToCart);
router.put("/", auth, cartController.updateCartItem);
router.delete("/", auth, cartController.removeItemFromCart);
router.delete("/clear", auth, cartController.clearCart);
module.exports = router;
