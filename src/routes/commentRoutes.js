const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const { auth } = require("../middleware/auth");
const commentController = require("../controllers/commentController");

// Lấy tất cả comment của 1 product
router.get("/:productId", async (req, res) => {
  try {
    const comments = await Comment.find({
      productId: req.params.productId,
    })
      .populate("customerId", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Thêm comment mới cho 1 product
router.post("/:productId", auth, async (req, res) => {
  try {
    const { content, rating } = req.body;
    const customerId = req.user.id;
    if (!content || !rating) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }
    // Kiểm tra user đã đánh giá sản phẩm này chưa
    const existed = await Comment.findOne({
      productId: req.params.productId,
      customerId,
    });
    if (existed) {
      return res
        .status(400)
        .json({ success: false, message: "Bạn đã đánh giá sản phẩm này rồi" });
    }
    const newComment = new Comment({
      productId: req.params.productId,
      customerId,
      content,
      rating,
    });
    await newComment.save();
    res.status(201).json({ success: true, data: newComment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// (Tùy chọn) Xóa 1 comment
router.delete("/:id", async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Comment deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Lấy tất cả comment (admin)
router.get("/", commentController.getAllComments);

module.exports = router;
