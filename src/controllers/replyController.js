const Reply = require("../models/Reply");

// Thêm trả lời cho comment
exports.createReply = async (req, res) => {
  try {
    const { content } = req.body;
    const { commentId } = req.params;
    const customerId = req.user.id;
    if (!content) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu nội dung trả lời" });
    }
    const reply = new Reply({ commentId, customerId, content });
    await reply.save();
    res.status(201).json({ success: true, data: reply });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách trả lời của comment
exports.getReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    const replies = await Reply.find({ commentId })
      .populate("customerId", "name email")
      .sort({ createdAt: 1 });
    res.json({ success: true, data: replies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa trả lời
exports.deleteReply = async (req, res) => {
  try {
    const { replyId } = req.params;
    const customerId = req.user.id;
    const reply = await Reply.findOne({ _id: replyId, customerId });
    if (!reply) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Không tìm thấy hoặc không có quyền xóa",
        });
    }
    await reply.deleteOne();
    res.json({ success: true, message: "Đã xóa trả lời" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
