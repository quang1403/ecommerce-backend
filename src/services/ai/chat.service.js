/**
 * Chat Service - AI Orchestrator
 * Điều phối tất cả các service AI khác
 */

const IntentService = require("./intent.service");
const PromptService = require("./prompt.service");
const RAGService = require("./rag.service");
const OpenAI = require("openai");

class ChatService {
  constructor() {
    this.intentService = new IntentService();
    this.promptService = new PromptService();
    this.ragService = new RAGService();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Main chat processing method
   * @param {string} message - User message
   * @param {Object} session - Chat session
   * @param {Object} user - User info
   * @returns {Promise<Object>} Chat response
   */
  async processChat(message, session, user) {
    try {
      // 1. Intent Detection
      const detectedIntent = await this.intentService.detectIntent(
        message,
        session
      );

      // IntentService return string, không phải object
      const intentType =
        typeof detectedIntent === "string"
          ? detectedIntent
          : detectedIntent.type;

      console.log(`🎯 Detected intent: ${intentType}`);

      // 2. Delegate to appropriate handler
      switch (intentType) {
        case "product_inquiry":
          return await this.handleProductInquiry(message, session, {
            type: intentType,
          });

        case "installment_inquiry":
        case "installment":
          return await this.handleInstallmentInquiry(message, session, {
            type: intentType,
          });

        case "product_compare":
        case "compare":
          return await this.handleProductCompare(message, session, {
            type: intentType,
          });

        case "order_tracking":
          return await this.handleOrderTracking(
            message,
            session,
            {
              type: intentType,
            },
            user
          );

        case "stock_check":
        case "check_stock":
          return await this.handleStockCheck(message, session, {
            type: intentType,
          });

        case "recommendation":
        case "recommendations":
          return await this.handleRecommendation(message, session, {
            type: intentType,
          });

        case "greeting":
          return await this.handleGreeting(message, session);

        case "general":
        default:
          return await this.handleGeneral(message, session);
      }
    } catch (error) {
      console.error("Chat processing error:", error);
      return {
        success: false,
        message: "Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại sau.",
        intent: "error",
      };
    }
  }

  /**
   * Handle product inquiry intent
   */
  async handleProductInquiry(message, session, intent) {
    const ProductSearchService = require("./productSearch.service");
    const productSearchService = new ProductSearchService();

    try {
      // Search for products
      const searchResults = await productSearchService.searchProducts(message);

      if (!searchResults.success) {
        // Nếu không tìm thấy, trả message rõ ràng KHÔNG BỊA GIÁ
        return {
          success: true,
          message:
            searchResults.message ||
            "Xin lỗi, chúng tôi không tìm thấy sản phẩm bạn yêu cầu trong hệ thống. Bạn có thể kiểm tra lại tên sản phẩm hoặc hỏi về sản phẩm khác không?",
          intent: "product_inquiry",
        };
      }

      const { products, searchInfo } = searchResults;

      // Generate AI response
      const prompt = this.promptService.createProductInquiryPrompt(
        products,
        message,
        this.getConversationContext(session)
      );

      const aiResponse = await this.generateAIResponse(prompt);

      // Update session context
      await this.updateSessionContext(session, {
        lastIntent: "product_inquiry",
        productOptions: products,
        searchInfo: searchInfo,
        lastMessage: message,
      });

      return {
        success: true,
        message: aiResponse,
        intent: "product_inquiry",
        data: {
          products: products,
          searchInfo: searchInfo,
        },
      };
    } catch (error) {
      console.error("Product inquiry error:", error);
      return {
        success: false,
        message: "Có lỗi xảy ra khi tìm kiếm sản phẩm. Vui lòng thử lại.",
        intent: "product_inquiry",
      };
    }
  }

  /**
   * Handle installment inquiry intent
   */
  async handleInstallmentInquiry(message, session, intent) {
    try {
      // Check if user has product context
      if (!session.productOptions || session.productOptions.length === 0) {
        // Need to search for product first
        const ProductSearchService = require("./productSearch.service");
        const productSearchService = new ProductSearchService();

        const searchResults = await productSearchService.searchProducts(
          message
        );

        if (!searchResults.success || searchResults.products.length === 0) {
          return {
            success: true,
            message: this.promptService.createInstallmentPolicyPrompt(),
            intent: "installment_inquiry",
          };
        }

        // Update session with found products
        await this.updateSessionContext(session, {
          productOptions: searchResults.products,
          lastIntent: "installment_inquiry",
        });
      }

      // If user is selecting a product by number or price
      const selection = this.parseProductSelection(
        message,
        session.productOptions
      );

      if (selection.success) {
        const selectedProduct = selection.product;

        // Calculate installment options
        const installmentOptions = this.calculateInstallmentOptions(
          selectedProduct.price
        );

        // Generate installment advice
        const installmentAdvice = this.generateInstallmentAdvice(
          selectedProduct,
          installmentOptions
        );

        // Update session
        await this.updateSessionContext(session, {
          currentProduct: selectedProduct,
          installmentOptions: installmentOptions,
          lastIntent: "installment_inquiry",
        });

        return {
          success: true,
          message: installmentAdvice,
          intent: "installment_inquiry",
          data: {
            product: selectedProduct,
            installmentOptions: installmentOptions,
          },
        };
      }

      // Generate general installment response
      const prompt = this.promptService.createGeneralPrompt(
        message,
        this.getConversationContext(session)
      );
      const aiResponse = await this.generateAIResponse(prompt);

      return {
        success: true,
        message: aiResponse,
        intent: "installment_inquiry",
      };
    } catch (error) {
      console.error("Installment inquiry error:", error);
      return {
        success: false,
        message: "Có lỗi xảy ra khi tính trả góp. Vui lòng thử lại.",
        intent: "installment_inquiry",
      };
    }
  }

  /**
   * Handle product comparison
   */
  async handleProductCompare(message, session, intent) {
    try {
      // Implementation for product comparison
      // This would use comparison logic from existing chatService
      return {
        success: true,
        message: "Tính năng so sánh sản phẩm đang được phát triển.",
        intent: "product_compare",
      };
    } catch (error) {
      console.error("Product compare error:", error);
      return {
        success: false,
        message: "Có lỗi xảy ra khi so sánh sản phẩm.",
        intent: "product_compare",
      };
    }
  }

  /**
   * Handle general inquiries
   */
  async handleGeneral(message, session) {
    try {
      // 🔍 Bước 1: Tìm trong Q&A Dataset trước
      const qaAnswer = await this.ragService.findQAAnswer(message);

      if (qaAnswer && qaAnswer.confidence > 0.7) {
        // Nếu tìm thấy với độ tin cậy cao (>70%), trả lời trực tiếp
        return {
          success: true,
          message: qaAnswer.answer,
          intent: qaAnswer.category || "general",
          confidence: qaAnswer.confidence,
          source: "qa_dataset",
        };
      }

      // 🤖 Bước 2: Nếu không tìm thấy, dùng AI
      const prompt = this.promptService.createGeneralPrompt(
        message,
        this.getConversationContext(session)
      );

      const aiResponse = await this.generateAIResponse(prompt);

      return {
        success: true,
        message: aiResponse,
        intent: "general",
        source: "ai_generated",
      };
    } catch (error) {
      console.error("General inquiry error:", error);
      return {
        success: false,
        message:
          "Xin lỗi, tôi không hiểu câu hỏi của bạn. Bạn có thể hỏi lại không?",
        intent: "general",
      };
    }
  }

  /**
   * Handle greeting
   */
  async handleGreeting(message, session) {
    const greetingMessages = [
      "Xin chào! Tôi là trợ lý tư vấn của Phone Store. Tôi có thể giúp bạn tìm kiếm điện thoại, tư vấn trả góp, hoặc giải đáp thắc mắc về sản phẩm. Bạn cần hỗ trợ gì?",
      "Chào bạn! Rất vui được phục vụ bạn tại Phone Store. Bạn đang quan tâm đến loại điện thoại nào?",
      "Hi! Tôi có thể giúp bạn tìm chiếc điện thoại phù hợp nhất. Bạn có ngân sách và yêu cầu cụ thể nào không?",
    ];

    const randomMessage =
      greetingMessages[Math.floor(Math.random() * greetingMessages.length)];

    return {
      success: true,
      message: randomMessage,
      intent: "greeting",
    };
  }

  /**
   * Generate AI response using OpenAI
   */
  async generateAIResponse(prompt) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: this.promptService.baseSystemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw new Error("Failed to generate AI response");
    }
  }

  /**
   * Parse product selection from user message
   */
  parseProductSelection(message, productOptions) {
    if (!productOptions || productOptions.length === 0) {
      return { success: false };
    }

    // Check for number selection (1, 2, 3, etc.)
    const numberMatch = message.match(/(?:số\s+)?(\d+)/i);
    if (numberMatch) {
      const number = parseInt(numberMatch[1]);
      if (number >= 1 && number <= productOptions.length) {
        return {
          success: true,
          product: productOptions[number - 1],
          selectionType: "number",
        };
      }
    }

    // Check for price-based selection
    const priceKeywords = ["rẻ nhất", "giá thấp nhất", "rẻ", "price"];
    if (
      priceKeywords.some((keyword) => message.toLowerCase().includes(keyword))
    ) {
      const cheapestProduct = productOptions.reduce((min, product) =>
        product.price < min.price ? product : min
      );
      return {
        success: true,
        product: cheapestProduct,
        selectionType: "price",
      };
    }

    return { success: false };
  }

  /**
   * Calculate installment options
   */
  calculateInstallmentOptions(price) {
    const terms = [3, 6, 9, 12, 18, 24];
    const interestRate = 0.02; // 2% per month

    return terms.map((term) => {
      const monthlyPayment = Math.ceil(price / term);
      const totalWithInterest = Math.ceil(
        price * (1 + interestRate * (term - 1))
      );
      const monthlyWithInterest = Math.ceil(totalWithInterest / term);

      return {
        term,
        monthlyPayment,
        monthlyWithInterest,
        totalWithInterest,
        interestAmount: totalWithInterest - price,
      };
    });
  }

  /**
   * Generate installment advice message
   */
  generateInstallmentAdvice(product, installmentOptions) {
    let advice = `💰 **Tư vấn trả góp cho ${product.name}**\n`;
    advice += `Giá: ${product.price.toLocaleString("vi-VN")}đ\n\n`;
    advice += `📋 **Các gói trả góp có sẵn:**\n\n`;

    installmentOptions.forEach((option) => {
      advice += `🔹 **${option.term} tháng:**\n`;
      advice += `   • Không lãi: ${option.monthlyPayment.toLocaleString(
        "vi-VN"
      )}đ/tháng\n`;
      advice += `   • Có lãi (2%/tháng): ${option.monthlyWithInterest.toLocaleString(
        "vi-VN"
      )}đ/tháng\n`;
      advice += `   • Tổng phải trả: ${option.totalWithInterest.toLocaleString(
        "vi-VN"
      )}đ\n\n`;
    });

    advice += `💡 **Khuyến nghị:** Nếu có thẻ tín dụng, chọn trả góp không lãi suất để tiết kiệm chi phí.\n\n`;
    advice += `Bạn muốn tìm hiểu thêm về gói trả góp nào?`;

    return advice;
  }

  /**
   * Get conversation context from session
   */
  getConversationContext(session) {
    if (!session.messages || session.messages.length === 0) return "";

    const messages = session.messages.slice(-5); // Last 5 messages
    return messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n");
  }

  /**
   * Update session context
   */
  async updateSessionContext(session, updates) {
    try {
      const ChatSession = require("../../models/ChatSession");

      await ChatSession.findByIdAndUpdate(session._id, {
        $set: updates,
        lastActivity: new Date(),
      });

      // Update local session object
      Object.assign(session, updates);
    } catch (error) {
      console.error("Error updating session context:", error);
    }
  }

  // Placeholder methods for other handlers
  async handleOrderTracking(message, session, intent, user) {
    try {
      // Require authentication for order tracking
      if (!user || !user.id) {
        return {
          success: false,
          message:
            "Để tra cứu đơn hàng, bạn cần đăng nhập. Vui lòng đăng nhập để tiếp tục.",
          intent: "order_tracking",
          requireAuth: true,
        };
      }

      const Order = require("../../models/Order");

      // Map status keywords to numbers (Order model uses Number enum: 0-4)
      const statusKeywords = {
        0: {
          pattern: /chờ xử lý|pending|mới đặt|chờ xác nhận/i,
          text: "đang chờ xử lý",
        },
        1: { pattern: /đã xác nhận|confirmed|đã duyệt/i, text: "đã xác nhận" },
        2: {
          pattern: /đang giao|shipping|đang vận chuyển/i,
          text: "đang giao hàng",
        },
        3: {
          pattern: /đã giao|delivered|hoàn thành|thành công/i,
          text: "đã giao hàng",
        },
        4: { pattern: /đã hủy|cancelled|hủy bỏ/i, text: "đã hủy" },
      };

      let searchByStatus = null;
      let statusText = null;
      for (const [statusNum, config] of Object.entries(statusKeywords)) {
        if (config.pattern.test(message)) {
          searchByStatus = parseInt(statusNum);
          statusText = config.text;
          break;
        }
      }

      // Search by status
      if (searchByStatus !== null) {
        const orders = await Order.find({
          status: searchByStatus,
          customerId: user.id, // Filter by authenticated user (Order uses customerId not userId)
        })
          .populate("customerId", "name email phone")
          .populate("items.productId", "name price")
          .sort({ createdAt: -1 })
          .limit(10);

        if (orders.length === 0) {
          return {
            success: true,
            message: `Hiện tại không có đơn hàng nào ${statusText}.`,
            intent: "order_tracking",
          };
        }

        // Format multiple orders
        let ordersList = `Danh sách đơn hàng ${statusText}:\n\n`;
        orders.forEach((order, index) => {
          ordersList += `${index + 1}. Đơn hàng: ${
            order.orderCode || order._id
          }\n`;
          ordersList += `   - Tổng tiền: ${order.total?.toLocaleString(
            "vi-VN"
          )}đ\n`;
          ordersList += `   - Ngày đặt: ${new Date(
            order.createdAt
          ).toLocaleDateString("vi-VN")}\n`;
          if (order.phone) {
            ordersList += `   - SĐT: ${order.phone}\n`;
          }
          ordersList += `\n`;
        });

        ordersList += `Bạn muốn xem chi tiết đơn hàng nào? Vui lòng cung cấp mã đơn hàng.`;

        return {
          success: true,
          message: ordersList,
          intent: "order_tracking",
          data: { orders },
        };
      }

      // Extract order code từ message
      const orderCodeMatch = message.match(/\b([A-Z0-9]{6,})\b/);
      const orderCode = orderCodeMatch ? orderCodeMatch[1] : null;

      if (!orderCode) {
        return {
          success: true,
          message:
            "Để tra cứu đơn hàng, bạn có thể:\n\n• Cung cấp mã đơn hàng (ví dụ: DH123456)\n• Hoặc hỏi về trạng thái đơn hàng (ví dụ: 'đơn hàng đang giao', 'đơn đã hủy')",
          intent: "order_tracking",
        };
      }

      // Tìm đơn hàng (filter by user)
      const order = await Order.findOne({
        orderCode: orderCode,
        customerId: user.id, // Only user's own orders
      })
        .populate("customerId", "name email phone")
        .populate("items.productId", "name price");

      if (!order) {
        return {
          success: true,
          message: `Không tìm thấy đơn hàng với mã ${orderCode}. Vui lòng kiểm tra lại mã đơn hàng.`,
          intent: "order_tracking",
        };
      }

      // Format thông tin đơn hàng
      const statusTextMap = {
        0: "Đang chờ xử lý",
        1: "Đã xác nhận",
        2: "Đang giao hàng",
        3: "Đã giao hàng",
        4: "Đã hủy",
      };

      const orderInfo = `Thông tin đơn hàng ${orderCode}:

- Trạng thái: ${statusTextMap[order.status] || order.status}
- Tổng tiền: ${order.total?.toLocaleString("vi-VN")}đ
- Địa chỉ giao: ${order.address || "N/A"}
- Số điện thoại: ${order.phone || "N/A"}
- Ngày đặt: ${new Date(order.createdAt).toLocaleDateString("vi-VN")}

Sản phẩm:
${order.items
  ?.map(
    (item, i) => `${i + 1}. ${item.productId?.name || "N/A"} x${item.quantity}`
  )
  .join("\n")}

Nếu bạn cần hỗ trợ thêm, vui lòng liên hệ hotline!`;

      return {
        success: true,
        message: orderInfo,
        intent: "order_tracking",
        data: { order },
      };
    } catch (error) {
      console.error("Order tracking error:", error);
      return {
        success: true,
        message:
          "Có lỗi khi tra cứu đơn hàng. Vui lòng thử lại hoặc liên hệ hotline.",
        intent: "order_tracking",
      };
    }
  }

  async handleStockCheck(message, session, intent) {
    try {
      const ProductSearchService = require("./productSearch.service");
      const productSearchService = new ProductSearchService();

      // Search for products
      const searchResults = await productSearchService.searchProducts(message);

      if (!searchResults.success || searchResults.products.length === 0) {
        return {
          success: true,
          message:
            "Không tìm thấy sản phẩm bạn muốn kiểm tra tồn kho. Vui lòng cung cấp tên sản phẩm rõ hơn.",
          intent: "stock_check",
        };
      }

      const products = searchResults.products.slice(0, 5);

      // Format stock info
      let stockInfo = "Thông tin tồn kho:\n\n";
      products.forEach((product, index) => {
        const stockStatus =
          product.stock > 0
            ? `✅ Còn ${product.stock} sản phẩm`
            : "❌ Hết hàng";

        stockInfo += `${index + 1}. ${
          product.name
        }\n   ${stockStatus}\n   Giá: ${product.price?.toLocaleString(
          "vi-VN"
        )}đ\n\n`;
      });

      stockInfo += "Bạn có muốn đặt hàng sản phẩm nào không?";

      return {
        success: true,
        message: stockInfo,
        intent: "stock_check",
        data: { products },
      };
    } catch (error) {
      console.error("Stock check error:", error);
      return {
        success: true,
        message: "Có lỗi khi kiểm tra tồn kho. Vui lòng thử lại.",
        intent: "stock_check",
      };
    }
  }

  async handleRecommendation(message, session, intent) {
    try {
      const Product = require("../../models/Product");

      // Extract budget from message
      const budgetMatch = message.match(
        /(\d+)\s*(?:triệu|tr|trieu|million|m)/i
      );
      const budget = budgetMatch ? parseInt(budgetMatch[1]) * 1000000 : null;

      // Build search criteria
      let criteria = {};

      if (budget) {
        criteria.price = { $lte: budget * 1.1 }; // Allow 10% buffer
      }

      // Check for specific needs
      if (/gaming|game|chơi game/i.test(message)) {
        criteria.ram = { $gte: 8 };
      }

      if (/camera|chụp ảnh|selfie/i.test(message)) {
        criteria.$or = [{ cameraRear: /\d{2,}MP/i }, { rating: { $gte: 4.5 } }];
      }

      if (/pin|battery|sạc/i.test(message)) {
        criteria.battery = { $gte: 4000 };
      }

      // Get recommendations
      const products = await Product.find(criteria)
        .populate("brand")
        .sort({ rating: -1, sold: -1 })
        .limit(5);

      if (products.length === 0) {
        return {
          success: true,
          message: budget
            ? `Rất tiếc, chúng tôi chưa có sản phẩm phù hợp với ngân sách ${budget.toLocaleString(
                "vi-VN"
              )}đ. Bạn có thể tăng ngân sách hoặc cho tôi biết thêm về nhu cầu của bạn.`
            : "Bạn có thể cho tôi biết ngân sách và nhu cầu sử dụng (gaming, camera, pin,...) để tôi gợi ý sản phẩm phù hợp hơn không?",
          intent: "recommendation",
        };
      }

      // Create recommendation prompt
      const prompt = this.promptService.createProductInquiryPrompt(
        products,
        message,
        this.getConversationContext(session)
      );

      const aiResponse = await this.generateAIResponse(prompt);

      return {
        success: true,
        message: aiResponse,
        intent: "recommendation",
        data: { products },
      };
    } catch (error) {
      console.error("Recommendation error:", error);
      return {
        success: true,
        message: "Có lỗi khi gợi ý sản phẩm. Vui lòng thử lại.",
        intent: "recommendation",
      };
    }
  }
}

module.exports = ChatService;
