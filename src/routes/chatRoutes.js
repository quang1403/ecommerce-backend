const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { auth, optionalAuth } = require("../middleware/auth");
const installmentController = require("../controllers/installmentController");

/**
 * Chatbot Routes
 *
 * RECOMMENDED (Endpoint duy nhất):
 * - POST /api/chat/ask - Endpoint duy nhất cho mọi loại câu hỏi
 *   Backend tự động nhận diện intent và xử lý phù hợp
 *   Body: { message, sessionId }
 *   Response: { success, reply, intent, ... }
 *
 * Session management:
 * - GET /api/chat/session/:sessionId - Lấy lịch sử chat session
 * - DELETE /api/chat/session/:sessionId - Xóa chat session
 *
 * Legacy endpoints (tương thích ngược):
 * - POST /api/chat/product-inquiry - Tư vấn sản phẩm cụ thể
 * - POST /api/chat/installment - Tư vấn trả góp
 */

// ⭐ ENDPOINT DUY NHẤT - Khuyến nghị sử dụng
router.post("/ask", optionalAuth, chatController.askChatbot);

// Legacy endpoints - Giữ lại để tương thích ngược
router.post("/product-inquiry", chatController.productInquiry);
router.post("/installment", chatController.installmentAdvice);

// Session management
router.get("/session/:sessionId", chatController.getChatSession);
router.delete("/session/:sessionId", chatController.deleteChatSession);

module.exports = router;
