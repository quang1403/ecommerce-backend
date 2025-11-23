const express = require("express");
const router = express.Router();
const replyController = require("../controllers/replyController");
const { auth } = require("../middleware/auth");

// Thêm trả lời cho comment
router.post("/:commentId/replies", auth, replyController.createReply);
// Lấy danh sách trả lời của comment
router.get("/:commentId/replies", replyController.getReplies);
// Xóa trả lời
router.delete("/replies/:replyId", auth, replyController.deleteReply);

module.exports = router;
