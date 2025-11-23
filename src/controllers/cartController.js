// src/controllers/cartController.js
const Cart = require("../models/Cart");

// Lấy giỏ hàng theo customerId
exports.getCartByCustomer = async (req, res) => {
  try {
    const customerId = req.user.id;
    const cart = await Cart.findOne({ customerId }).populate("items.productId");
    if (!cart)
      return res.status(404).json({ error: "Không tìm thấy giỏ hàng" });
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy giỏ hàng" });
  }
};

// Thêm sản phẩm vào giỏ hàng
exports.addToCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity, variant } = req.body; // nhận thêm variant

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      cart = new Cart({
        customerId,
        items: [{ productId, quantity, variant }],
      });
    } else {
      // Tìm item theo productId và variant (so sánh sâu)
      const itemIndex = cart.items.findIndex(
        (item) =>
          item.productId.toString() === productId &&
          JSON.stringify(item.variant) === JSON.stringify(variant)
      );

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += quantity;
      } else {
        cart.items.push({ productId, quantity, variant });
      }
    }

    await cart.save();
    res.status(200).json(cart);
  } catch (err) {
    res.status(400).json({ error: "Lỗi khi thêm vào giỏ hàng" });
  }
};

// Cập nhật số lượng sản phẩm trong giỏ
exports.updateCartItem = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity } = req.body;
    const cart = await Cart.findOne({ customerId });

    if (!cart)
      return res.status(404).json({ error: "Không tìm thấy giỏ hàng" });

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );
    if (itemIndex === -1)
      return res.status(404).json({ error: "Sản phẩm không có trong giỏ" });

    cart.items[itemIndex].quantity = quantity;
    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(400).json({ error: "Lỗi khi cập nhật giỏ hàng" });
  }
};

// Xóa sản phẩm khỏi giỏ
exports.removeItemFromCart = async (req, res) => {
  try {
    console.log("Xóa sản phẩm khỏi giỏ hàng:");
    const customerId = req.user.id;
    const { productId } = req.body;
    console.log("customerId:", customerId);
    console.log("productId cần xóa:", productId);

    const cart = await Cart.findOne({ customerId });
    if (!cart) {
      console.log("Không tìm thấy giỏ hàng cho user:", customerId);
      return res.status(404).json({ error: "Không tìm thấy giỏ hàng" });
    }

    const beforeCount = cart.items.length;
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );
    const afterCount = cart.items.length;
    await cart.save();

    if (beforeCount === afterCount) {
      console.log(
        "Không xóa được sản phẩm, không tìm thấy productId trong giỏ hàng."
      );
    } else {
      console.log("Đã xóa thành công productId:", productId);
    }

    res.json({ message: "Đã xóa sản phẩm khỏi giỏ" });
  } catch (err) {
    console.error("Lỗi khi xóa sản phẩm khỏi giỏ hàng:", err);
    res.status(400).json({ error: "Lỗi khi xóa sản phẩm khỏi giỏ hàng" });
  }
};
// Xóa tất cả sản phẩm khỏi giỏ

exports.clearCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const cart = await Cart.findOne({ customerId });
    if (!cart)
      return res.status(404).json({ error: "Không tìm thấy giỏ hàng" });

    cart.items = [];
    await cart.save();
    res.json({ message: "Đã xóa toàn bộ giỏ hàng" });
  } catch (err) {
    console.error("Lỗi khi xóa toàn bộ giỏ hàng:", err);
    res.status(400).json({ error: "Lỗi khi xóa toàn bộ giỏ hàng" });
  }
};
