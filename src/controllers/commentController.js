const Comment = require("../models/Comment");

// Thêm comment mới
exports.createComment = async (req, res) => {
  try {
    const { content, rating } = req.body;
    const { productId } = req.params;
    const customerId = req.user.id;

    if (!content || !rating || !productId) {
      return res
        .status(400)
        .json({ status: "error", message: "Thiếu dữ liệu" });
    }
    // Kiểm tra user đã đánh giá sản phẩm này chưa
    const existed = await Comment.findOne({ productId, customerId });
    if (existed) {
      return res
        .status(400)
        .json({ status: "error", message: "Bạn đã đánh giá sản phẩm này rồi" });
    }
    const comment = new Comment({
      productId,
      customerId,
      content,
      rating,
    });
    await comment.save();
    res.json({
      status: "success",
      message: "Thêm đánh giá thành công",
      data: comment,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Lấy danh sách comment theo productId
exports.getComments = async (req, res) => {
  try {
    const { productId } = req.params;
    // Populate thông tin user và chỉ lấy các trường cần thiết
    const comments = await Comment.find({ productId })
      .populate("customerId", "name email")
      .sort({ createdAt: -1 });
    res.json({
      status: "success",
      data: { docs: comments },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Lấy tất cả comment (admin)
exports.getAllComments = async (req, res) => {
  try {
    const comments = await Comment.find({})
      .populate("productId", "name")
      .populate("customerId", "name email")
      .sort({ createdAt: -1 });
    res.json({ status: "success", data: comments });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
