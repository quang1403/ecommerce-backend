const ChatService = require("../services/ai/chat.service");

/**
 * Controller xử lý các API endpoints cho chatbot
 * Updated to use new AI architecture
 */

/**
 * POST /api/chat/ask
 * Endpoint duy nhất cho mọi loại câu hỏi
 * Backend tự động nhận diện intent và xử lý phù hợp
 */
exports.askChatbot = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user?.id || null; // Optional - guest có thể chat

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Thiếu nội dung tin nhắn",
      });
    }

    // Tạo sessionId nếu chưa có
    const finalSessionId =
      sessionId ||
      `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get or create chat session
    const ChatSession = require("../models/ChatSession");
    let session = await ChatSession.findOne({ sessionId: finalSessionId });

    if (!session) {
      session = await ChatSession.create({
        sessionId: finalSessionId,
        userId: userId,
        context: {},
        createdAt: new Date(),
        lastActivity: new Date(),
      });
    }

    // Initialize chat service and process message
    const startTime = Date.now();
    const chatService = new ChatService();
    const response = await chatService.processChat(message, session, {
      id: userId,
    });
    const responseTime = Date.now() - startTime;

    // 💬 LƯU MESSAGES VÀO SESSION (để maintain conversation context)
    try {
      await session.addMessage("user", message);
      await session.addMessage("assistant", response.message, {
        intent: response.intent,
        confidence: response.confidence,
      });
    } catch (msgError) {
      console.error("⚠️ Lỗi khi lưu messages vào session:", msgError.message);
    }

    // 🔥 TỰ ĐỘNG LƯU VÀO CHATLOG (để training & analytics)
    try {
      const ChatLog = require("../models/ChatLog");
      await ChatLog.create({
        sessionId: finalSessionId,
        userId: userId,
        userMessage: message,
        detectedIntent: response.intent || "unknown",
        intentConfidence: response.confidence || 1.0,
        botResponse: response.message,
        contextData: response.data || {},
        responseTime: responseTime,
        usedAI: true,
        aiModel: "gpt-4o-mini",
        markedForTraining: response.success, // Chỉ lưu khi thành công
        createdAt: new Date(),
      });
    } catch (logError) {
      console.error("⚠️ Lỗi khi lưu ChatLog:", logError.message);
      // Không throw error để không ảnh hưởng response
    }

    // 🔥 TỰ ĐỘNG LƯU VÀO DATASET (file-based backup)
    try {
      const DatasetService = require("../services/ai/dataset.service");
      const datasetService = new DatasetService();

      await datasetService.saveTrainingData({
        sessionId: finalSessionId,
        userMessage: message,
        detectedIntent: response.intent || "unknown",
        botResponse: response.message,
        wasHelpful: null, // Sẽ update sau khi có feedback
        timestamp: new Date(),
      });

      // Nếu có sản phẩm được gợi ý, lưu suggestion
      if (response.data?.products && response.data.products.length > 0) {
        await datasetService.saveSuggestion({
          sessionId: finalSessionId,
          userMessage: message,
          suggestedProducts: response.data.products,
          userSelected: null, // Sẽ update khi user chọn
          timestamp: new Date(),
        });
      }
    } catch (datasetError) {
      console.error("⚠️ Lỗi khi lưu Dataset:", datasetError.message);
      // Không throw error để không ảnh hưởng response
    }

    // Return the response from the new AI architecture
    // Format để match FE expectations
    const finalResponse = {
      success: response.success,
      reply: response.message,
      intent: response.intent,
      sessionId: finalSessionId,
      timestamp: new Date(),
      responseTime: responseTime,
    };

    // Nếu có products, format cho FE
    if (response.data?.products && response.data.products.length > 0) {
      // FE expect 'product' (singular) với first product
      const firstProduct = response.data.products[0];

      console.log(
        `🎁 Preparing product for actions: ${firstProduct.name} (ID: ${firstProduct._id})`
      );

      // Tính giá sau giảm cho product
      const originalPrice = firstProduct.price;
      const discount = firstProduct.discount || 0;
      const finalPrice =
        discount > 0
          ? Math.round(originalPrice * (1 - discount / 100))
          : originalPrice;

      // Add calculated fields to product
      finalResponse.product = {
        ...firstProduct,
        originalPrice: originalPrice,
        finalPrice: finalPrice,
        discountAmount: discount > 0 ? originalPrice - finalPrice : 0,
      };

      // Thêm colorVariants vào response data nếu có
      if (firstProduct.colorVariants && firstProduct.colorVariants.length > 0) {
        finalResponse.colorVariants = firstProduct.colorVariants;
        console.log(
          `✅ Trả về ${firstProduct.colorVariants.length} colorVariants cho FE`
        );
      } else if (firstProduct.color && firstProduct.color.length > 0) {
        // Fallback về color legacy
        finalResponse.colors = firstProduct.color;
        console.log(
          `⚠️ Fallback về color legacy: ${firstProduct.color.join(", ")}`
        );
      }

      // Thêm actions cho product
      finalResponse.actions = [
        { type: "add_to_cart", label: "Thêm vào giỏ" },
        { type: "buy_now", label: "Mua ngay" },
        { type: "installment", label: "Trả góp" },
      ];

      // Giữ lại full products list với giá sau giảm
      finalResponse.products = response.data.products.map((p) => {
        const pOriginalPrice = p.price;
        const pDiscount = p.discount || 0;
        const pFinalPrice =
          pDiscount > 0
            ? Math.round(pOriginalPrice * (1 - pDiscount / 100))
            : pOriginalPrice;

        return {
          ...p,
          originalPrice: pOriginalPrice,
          finalPrice: pFinalPrice,
          discountAmount: pDiscount > 0 ? pOriginalPrice - pFinalPrice : 0,
        };
      });
    } else {
      console.log(
        `⚠️ No products in response for intent: ${
          response.intent
        }, message: "${message.substring(0, 50)}..."`
      );
    }

    // Spread remaining data
    if (response.data) {
      const { products, ...otherData } = response.data;
      Object.assign(finalResponse, otherData);
    }

    console.log(
      `📤 Final response: intent=${
        finalResponse.intent
      }, hasProduct=${!!finalResponse.product}, hasActions=${!!finalResponse.actions}`
    );

    res.json(finalResponse);
  } catch (error) {
    console.error("Error in askChatbot:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi khi xử lý câu hỏi",
      details: error.message,
    });
  }
};

/**
 * POST /api/chat/product-inquiry
 * Legacy endpoint - forwards to new architecture
 */
exports.productInquiry = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user?.id || null;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Thiếu nội dung tin nhắn",
      });
    }

    const finalSessionId =
      sessionId ||
      `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get or create chat session
    const ChatSession = require("../models/ChatSession");
    let session = await ChatSession.findOne({ sessionId: finalSessionId });

    if (!session) {
      session = await ChatSession.create({
        sessionId: finalSessionId,
        userId: userId,
        context: {},
        createdAt: new Date(),
        lastActivity: new Date(),
      });
    }

    // Initialize chat service and process message
    const chatService = new ChatService();
    const response = await chatService.processChat(message, session, {
      id: userId,
    });

    res.json({
      success: true,
      reply: response.message,
      intent: response.intent,
      sessionId: finalSessionId,
      timestamp: new Date(),
      ...response.data,
    });
  } catch (error) {
    console.error("Error in productInquiry:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi khi xử lý tư vấn sản phẩm",
      details: error.message,
    });
  }
};

/**
 * POST /api/chat/installment-advice
 * Legacy endpoint - forwards to new architecture
 */
exports.installmentAdvice = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user?.id || null;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Thiếu nội dung tin nhắn",
      });
    }

    const finalSessionId =
      sessionId ||
      `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get or create chat session
    const ChatSession = require("../models/ChatSession");
    let session = await ChatSession.findOne({ sessionId: finalSessionId });

    if (!session) {
      session = await ChatSession.create({
        sessionId: finalSessionId,
        userId: userId,
        context: {},
        createdAt: new Date(),
        lastActivity: new Date(),
      });
    }

    // Initialize chat service and process message
    const chatService = new ChatService();
    const response = await chatService.processChat(message, session, {
      id: userId,
    });

    res.json({
      success: true,
      reply: response.message,
      intent: response.intent,
      sessionId: finalSessionId,
      timestamp: new Date(),
      ...response.data,
    });
  } catch (error) {
    console.error("Error in installmentAdvice:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi khi xử lý tư vấn trả góp",
      details: error.message,
    });
  }
};

/**
 * GET /api/chat/session/:sessionId
 * Lấy thông tin session chat
 */
exports.getChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const ChatSession = require("../models/ChatSession");

    const session = await ChatSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy session",
      });
    }

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        context: session.context,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
      },
    });
  } catch (error) {
    console.error("Error in getChatSession:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi khi lấy thông tin session",
      details: error.message,
    });
  }
};

/**
 * DELETE /api/chat/session/:sessionId
 * Xóa session chat
 */
exports.deleteChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const ChatSession = require("../models/ChatSession");

    const result = await ChatSession.deleteOne({ sessionId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy session để xóa",
      });
    }

    res.json({
      success: true,
      message: "Đã xóa session thành công",
    });
  } catch (error) {
    console.error("Error in deleteChatSession:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi khi xóa session",
      details: error.message,
    });
  }
};
