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
      // Kiểm tra nếu đang hỏi về màu sắc của sản phẩm cụ thể
      const lowerMsg = message.toLowerCase().trim();
      const isAskingColors =
        (lowerMsg.includes("màu") ||
          lowerMsg.includes("mau") ||
          lowerMsg.includes("color") ||
          lowerMsg.includes("mầu")) &&
        /\b(iphone|ipad|samsung|galaxy|xiaomi|redmi|oppo|vivo|realme|nokia)/i.test(
          lowerMsg
        );

      console.log("🎨 Kiểm tra câu hỏi màu sắc:", {
        message: message,
        isAskingColors: isAskingColors,
      });

      // 📊 Tích lũy thông tin từ conversation context
      const conversationContext = this.extractSearchContext(message, session);
      console.log("📊 Conversation context:", conversationContext);

      // Tạo enhanced query từ context
      let enhancedQuery = message;
      if (conversationContext.hasContext) {
        const contextParts = [];
        if (conversationContext.brand)
          contextParts.push(conversationContext.brand);
        if (conversationContext.budget)
          contextParts.push(`${conversationContext.budget} triệu`);
        if (conversationContext.features.length > 0) {
          contextParts.push(...conversationContext.features);
        }

        if (contextParts.length > 0) {
          enhancedQuery = `${contextParts.join(" ")} ${message}`;
          console.log("🔍 Enhanced query:", enhancedQuery);
        }
      }

      // Search for products with enhanced query
      const searchResults = await productSearchService.searchProducts(
        enhancedQuery
      );

      if (!searchResults.success) {
        // Phân tích intent để trả lời phù hợp
        const lowerMsg = message.toLowerCase();

        // Kiểm tra nếu hỏi về sản phẩm NGOÀI phạm vi cửa hàng
        const outOfScopeKeywords = [
          "playstation",
          "ps4",
          "ps5",
          "xbox",
          "nintendo",
          "switch",
          "laptop",
          "máy tính",
          "pc",
          "macbook",
          "tivi",
          "tv",
          "màn hình",
          "monitor",
          "camera",
          "máy ảnh", // camera riêng, không phải camera phone
        ];

        const isOutOfScope = outOfScopeKeywords.some((keyword) =>
          lowerMsg.includes(keyword)
        );

        if (isOutOfScope) {
          return {
            success: true,
            message:
              "Xin lỗi bạn, Phone Store chuyên về điện thoại, tablet và phụ kiện di động (tai nghe, sạc, ốp lưng...). " +
              "Chúng mình không kinh doanh các sản phẩm như máy chơi game console, laptop, camera riêng lẻ.\n\n" +
              "Tuy nhiên, nếu bạn quan tâm đến:\n" +
              "📱 Điện thoại chơi game mượt mà\n" +
              "📱 Điện thoại camera chụp ảnh đẹp\n" +
              "📱 Tablet để giải trí hoặc làm việc\n\n" +
              "Hãy cho mình biết để tư vấn bạn nhé! 😊",
            intent: "product_inquiry",
            confidence: 1.0,
          };
        }

        // ⚠️ Nếu đã có context nhưng vẫn không tìm thấy → Thông báo rõ ràng
        if (conversationContext.hasContext) {
          const contextSummary = [];
          if (conversationContext.brand)
            contextSummary.push(`Thương hiệu: ${conversationContext.brand}`);
          if (conversationContext.budget)
            contextSummary.push(
              `Ngân sách: ${conversationContext.budget} triệu`
            );
          if (conversationContext.features.length > 0) {
            contextSummary.push(
              `Yêu cầu: ${conversationContext.features.join(", ")}`
            );
          }

          return {
            success: true,
            message:
              `Mình đã tìm theo yêu cầu của bạn:\n${contextSummary.join(
                "\n"
              )}\n\n` +
              "Nhưng rất tiếc, hiện tại không có sản phẩm phù hợp trong hệ thống. " +
              "Bạn có thể:\n" +
              "💡 Điều chỉnh ngân sách (cao hơn hoặc thấp hơn)\n" +
              "💡 Xem xét thương hiệu khác (Samsung, Oppo, Vivo, Realme...)\n" +
              "💡 Linh hoạt về tính năng\n\n" +
              "Hoặc bạn muốn xem các sản phẩm tương tự trong khoảng giá gần nhất không? 😊",
            intent: "product_inquiry",
            confidence: 1.0,
          };
        }

        // Nếu không tìm thấy và chưa có đủ context, hỏi thêm (nhưng CHỈ 1 lần)
        return {
          success: true,
          message:
            "Xin lỗi, hiện tại chúng mình không tìm thấy sản phẩm phù hợp với yêu cầu của bạn trong hệ thống. " +
            "Bạn có thể cho mình biết thêm về:\n" +
            "📱 Thương hiệu bạn quan tâm (iPhone, Samsung, Xiaomi, Oppo, Vivo...)\n" +
            "💰 Ngân sách dự kiến của bạn\n" +
            "🎯 Mục đích sử dụng chính (chơi game, chụp ảnh, công việc, giải trí...)\n" +
            "⚡ Tính năng ưu tiên (camera, pin, hiệu năng, màn hình...)\n\n" +
            "để mình có thể tư vấn chính xác hơn cho bạn nhé! 😊",
          intent: "product_inquiry",
          confidence: 1.0,
        };
      }

      const { products, searchInfo } = searchResults;

      // Xử lý đặc biệt cho câu hỏi màu sắc
      if (isAskingColors && products.length > 0) {
        console.log("🎨 Xử lý câu hỏi màu sắc cho sản phẩm:", products[0].name);
        const product = products[0];

        // Ưu tiên colorVariants, fallback về color legacy
        if (product.colorVariants && product.colorVariants.length > 0) {
          const colorsInfo = product.colorVariants.map((variant) => {
            return `${variant.color} (mã ${variant.colorCode}, còn ${variant.stock} máy)`;
          });

          const colorResponse = `${product.name} hiện có ${
            product.colorVariants.length
          } màu sắc:\n\n${colorsInfo
            .map((info, idx) => `${idx + 1}. ${info}`)
            .join(
              "\n"
            )}\n\nBạn thích màu nào nhất? Tôi có thể giúp bạn kiểm tra tình trạng hàng hoặc đặt hàng ngay.`;

          console.log("✅ Trả lời từ colorVariants:", colorResponse);

          return {
            success: true,
            message: colorResponse,
            intent: "product_inquiry",
            data: {
              products: [product],
              searchInfo: searchInfo,
              colorVariants: product.colorVariants,
            },
          };
        } else if (product.color && product.color.length > 0) {
          const colorResponse = `${product.name} hiện có ${
            product.color.length
          } màu: ${product.color.join(
            ", "
          )}.\n\nBạn muốn xem chi tiết màu nào?`;

          console.log("✅ Trả lời từ color legacy:", colorResponse);

          return {
            success: true,
            message: colorResponse,
            intent: "product_inquiry",
            data: {
              products: [product],
              searchInfo: searchInfo,
              colors: product.color,
            },
          };
        }
      }

      // Generate AI response
      const prompt = this.promptService.createProductInquiryPrompt(
        products,
        message,
        this.getConversationContext(session),
        isAskingColors
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
      const ProductSearchService = require("./productSearch.service");
      const productSearchService = new ProductSearchService();

      // Extract product names from comparison query
      // Patterns: "A vs B", "A và B", "so sánh A với B", "A hay B"
      const vsPattern =
        /(.+?)\s+(?:vs|versus|với|và|hay)\s+(.+?)(?:\s+(?:tốt hơn|nào tốt|hiệu năng|camera|pin|giá).*)?$/i;
      const soSanhPattern =
        /so sánh\s+(.+?)\s+(?:với|và|vs)\s+(.+?)(?:\s+(?:tốt hơn|nào tốt|hiệu năng|camera|pin|giá).*)?$/i;

      let product1Name = null;
      let product2Name = null;

      let match = message.match(soSanhPattern) || message.match(vsPattern);
      if (match) {
        product1Name = match[1].trim();
        product2Name = match[2].trim();
      }

      // If pattern doesn't match, try to extract 2 product mentions
      if (!product1Name || !product2Name) {
        // Try to find phone model patterns
        const phonePatterns = [
          /\b(iphone\s+\d+[\w\s]*?(?:pro|plus|max|mini)?)/gi,
          /\b(galaxy\s+[a-z]\d+\s*(?:5g|4g|ultra|plus|fe)?)/gi,
          /\b(galaxy\s+z\s+(?:fold|flip)\s*\d*)/gi,
          /\b(xiaomi\s+\d+[\w\s]*?(?:pro|plus|ultra|t)?)/gi,
          /\b(redmi\s+(?:note\s*)?\d+[\w\s]*?(?:pro|plus)?)/gi,
          /\b(oppo\s+[a-z]*\s*\d+[\w\s]*?(?:pro|plus)?)/gi,
        ];

        const foundProducts = [];
        const seen = new Set(); // Track lowercase versions to avoid duplicates

        for (const pattern of phonePatterns) {
          const matches = message.matchAll(pattern);
          for (const m of matches) {
            if (m[1]) {
              const normalized = m[1].trim().toLowerCase();
              // Check if this is not a subset of already found product
              let isDuplicate = false;
              for (const existing of seen) {
                if (
                  normalized.includes(existing) ||
                  existing.includes(normalized)
                ) {
                  isDuplicate = true;
                  break;
                }
              }

              if (!isDuplicate) {
                foundProducts.push(m[1].trim());
                seen.add(normalized);
              }
            }
          }
        }

        if (foundProducts.length >= 2) {
          product1Name = foundProducts[0];
          product2Name = foundProducts[1];
        }
      }

      if (!product1Name || !product2Name) {
        return {
          success: true,
          message:
            "Vui lòng cho tôi biết 2 sản phẩm bạn muốn so sánh. Ví dụ: 'So sánh iPhone 15 và Samsung Galaxy S24' hoặc 'iPhone 15 vs Galaxy S24'",
          intent: "product_compare",
        };
      }

      // Search for both products
      const [search1, search2] = await Promise.all([
        productSearchService.searchProducts(product1Name),
        productSearchService.searchProducts(product2Name),
      ]);

      const product1 =
        search1.success && search1.products.length > 0
          ? search1.products[0]
          : null;
      const product2 =
        search2.success && search2.products.length > 0
          ? search2.products[0]
          : null;

      // Case 1: Both products found - do comparison
      if (product1 && product2) {
        const prompt = this.promptService.createComparePrompt(
          [product1, product2],
          message
        );

        const aiResponse = await this.generateAIResponse(prompt);

        return {
          success: true,
          message: aiResponse,
          intent: "product_compare",
          data: {
            products: [product1, product2],
            comparison: true,
          },
        };
      }

      // Case 2: Only one product found - suggest similar products to compare
      if (product1 && !product2) {
        // Find similar products in same price range or brand
        const similarProducts = await productSearchService.searchProducts(
          `${product1.brand?.name || ""} điện thoại`
        );

        const suggestions = similarProducts.products
          .filter((p) => p._id.toString() !== product1._id.toString())
          .slice(0, 3);

        let message = `Tôi tìm thấy sản phẩm ${product1.name} nhưng không tìm thấy "${product2Name}" trong kho.\n\n`;

        if (suggestions.length > 0) {
          message += `Bạn có muốn so sánh ${product1.name} với:\n`;
          suggestions.forEach((p, i) => {
            message += `${i + 1}. ${p.name} - ${p.price.toLocaleString(
              "vi-VN"
            )}đ\n`;
          });
        } else {
          message += `Bạn có thể cho tôi biết sản phẩm thứ 2 chính xác hơn không?`;
        }

        return {
          success: true,
          message,
          intent: "product_compare",
          data: {
            foundProduct: product1,
            suggestions,
            missingProduct: product2Name,
          },
        };
      }

      if (!product1 && product2) {
        // Similar logic but for product2
        const similarProducts = await productSearchService.searchProducts(
          `${product2.brand?.name || ""} điện thoại`
        );

        const suggestions = similarProducts.products
          .filter((p) => p._id.toString() !== product2._id.toString())
          .slice(0, 3);

        let message = `Tôi tìm thấy sản phẩm ${product2.name} nhưng không tìm thấy "${product1Name}" trong kho.\n\n`;

        if (suggestions.length > 0) {
          message += `Bạn có muốn so sánh ${product2.name} với:\n`;
          suggestions.forEach((p, i) => {
            message += `${i + 1}. ${p.name} - ${p.price.toLocaleString(
              "vi-VN"
            )}đ\n`;
          });
        } else {
          message += `Bạn có thể cho tôi biết sản phẩm thứ nhất chính xác hơn không?`;
        }

        return {
          success: true,
          message,
          intent: "product_compare",
          data: {
            foundProduct: product2,
            suggestions,
            missingProduct: product1Name,
          },
        };
      }

      // Case 3: Neither product found
      return {
        success: true,
        message: `Rất tiếc, tôi không tìm thấy cả 2 sản phẩm "${product1Name}" và "${product2Name}" trong kho. Bạn có thể cung cấp tên sản phẩm chính xác hơn không?`,
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

  /**
   * Extract search context from conversation history
   * Tích lũy thông tin: brand, budget, features từ conversation
   */
  extractSearchContext(currentMessage, session) {
    const context = {
      brand: null,
      budget: null,
      features: [],
      hasContext: false,
    };

    // Lấy lịch sử conversation
    const messages = session.messages || [];
    const allMessages = [...messages.map((m) => m.content), currentMessage]
      .join(" ")
      .toLowerCase();

    // Extract brand
    const brandPatterns = {
      xiaomi: /\b(xiaomi|xiaomu|redmi|poco)\b/i,
      samsung: /\b(samsung|sam sung|galaxy)\b/i,
      iphone: /\b(iphone|ip|apple)\b/i,
      oppo: /\b(oppo|reno|find)\b/i,
      vivo: /\b(vivo)\b/i,
      realme: /\b(realme)\b/i,
    };

    for (const [brand, pattern] of Object.entries(brandPatterns)) {
      if (pattern.test(allMessages)) {
        context.brand = brand;
        context.hasContext = true;
        break;
      }
    }

    // Extract budget (10 triệu, 10tr, 10000000...)
    const budgetMatch = allMessages.match(
      /(\d+)\s*(?:triệu|tr|trieu|million|m|k|ngàn)/i
    );
    if (budgetMatch) {
      const num = parseInt(budgetMatch[1]);
      const unit = budgetMatch[0].toLowerCase();

      if (unit.includes("k") || unit.includes("ngàn")) {
        context.budget = num / 1000; // 10000k = 10 triệu
      } else {
        context.budget = num; // 10 triệu
      }
      context.hasContext = true;
    }

    // Extract features
    const featurePatterns = {
      gaming:
        /\b(gaming|game|chơi game|choi game|máy chơi game|hiệu năng|performance)\b/i,
      camera: /\b(camera|chụp ảnh|chup anh|máy chụp ảnh|selfie|quay video)\b/i,
      pin: /\b(pin|battery|pin trâu|pin khỏe|pin lớn|dung lượng pin)\b/i,
      "màn hình": /\b(màn hình|man hinh|display|screen|màn to|màn lớn)\b/i,
    };

    for (const [feature, pattern] of Object.entries(featurePatterns)) {
      if (pattern.test(allMessages)) {
        context.features.push(feature);
        context.hasContext = true;
      }
    }

    return context;
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
