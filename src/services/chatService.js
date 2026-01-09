const axios = require("axios");
const ChatSession = require("../models/ChatSession");
const productSearchService = require("./productSearchService");
const Order = require("../models/Order");
const Product = require("../models/Product");

/**
 * Service xử lý logic AI với ChatGPT
 */
class ChatService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = "https://api.openai.com/v1/chat/completions";
    this.model = "gpt-4o-mini";
    this.baseSystemPrompt = `Bạn là trợ lý tư vấn bán hàng chuyên nghiệp của cửa hàng điện thoại Phone Store.

Nhiệm vụ của bạn:
- Tư vấn điện thoại, phụ kiện phù hợp với nhu cầu khách hàng
- Giải đáp thắc mắc về sản phẩm, thông số kỹ thuật, giá cả
- Hướng dẫn so sánh sản phẩm
- Tra cứu đơn hàng và thông tin bảo hành
- Giới thiệu chương trình khuyến mãi
- Hỗ trợ đặt hàng
- Tư vấn về màu sắc sản phẩm với thông tin chi tiết về tồn kho từng màu

Phong cách giao tiếp:
- Thân thiện, nhiệt tình và chuyên nghiệp
- Trả lời ngắn gọn, súc tích, dễ hiểu
- Đưa ra gợi ý cụ thể khi khách hàng chưa rõ nhu cầu
- Luôn hỏi thêm thông tin nếu cần để tư vấn chính xác hơn
- Khi tư vấn màu sắc, luôn thông báo rõ ràng màu nào còn/hết hàng

LƯU Ý VỀ MÀU SẮC:
- Mỗi sản phẩm có thể có nhiều màu sắc với tồn kho riêng biệt
- Khi khách hỏi về màu, hãy liệt kê đầy đủ các màu kèm trạng thái tồn kho
- Nếu màu nào hết hàng (stock = 0), thông báo rõ ràng và gợi ý màu khác còn hàng
- Mỗi màu có thể có ảnh riêng và mã SKU riêng để quản lý

QUAN TRỌNG: Chỉ tư vấn các sản phẩm CÓ TRONG DANH SÁCH bên dưới. Không bịa đặt hoặc giới thiệu sản phẩm không có sẵn.`;
    this.productListCache = null;
    this.productListCacheTime = null;
  }

  /**
   * Lấy danh sách sản phẩm từ database và cache 5 phút
   */
  async getProductListContext() {
    const now = Date.now();
    // Cache 5 phút để giảm tải database
    if (
      this.productListCache &&
      this.productListCacheTime &&
      now - this.productListCacheTime < 300000
    ) {
      return this.productListCache;
    }

    try {
      // Lấy TOÀN BỘ sản phẩm còn hàng từ database
      const products = await Product.find({ stock: { $gt: 0 } })
        .populate("brand", "name")
        .select("name price brand ram storage battery stock discount")
        .sort({ brand: 1, price: 1 }); // Sắp xếp theo hãng và giá

      const productList = products
        .map(
          (p, i) =>
            `${i + 1}. ${p.name} - Giá: ${p.price.toLocaleString("vi-VN")}đ${
              p.discount > 0 ? ` (Giảm ${p.discount}%)` : ""
            } - Hãng: ${p.brand?.name || "N/A"} - RAM: ${p.ram}GB - ROM: ${
              p.storage
            }GB - Pin: ${p.battery}mAh - Tồn kho: ${p.stock}`
        )
        .join("\n");

      this.productListCache = `\n\n📱 DANH SÁCH SẢN PHẨM CÓ SẴN (${products.length} sản phẩm):\n${productList}`;
      this.productListCacheTime = now;
      return this.productListCache;
    } catch (error) {
      console.error("Error getting product list:", error);
      return "";
    }
  }

  /**
   * Gọi ChatGPT API với system prompt đầy đủ
   */
  async callGeminiAPI(prompt, context = "") {
    try {
      // Lấy danh sách sản phẩm từ database
      const productListContext = await this.getProductListContext();
      const fullSystemPrompt = this.baseSystemPrompt + productListContext;

      const messages = [{ role: "system", content: fullSystemPrompt }];

      if (context) {
        messages.push({
          role: "system",
          content: `Thông tin bổ sung:\n${context}`,
        });
      }

      messages.push({ role: "user", content: prompt });

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1024,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error(
        "ChatGPT API Error:",
        error.response?.data || error.message
      );
      throw new Error("Không thể kết nối với AI service");
    }
  }

  /**
   * Xử lý câu hỏi chung
   */
  async handleGeneralQuestion(userId, sessionId, message) {
    try {
      // Lấy hoặc tạo session
      let session = await ChatSession.findOne({ sessionId });
      if (!session) {
        session = new ChatSession({ userId, sessionId });
        await session.save();
      }

      // Thêm message của user
      await session.addMessage("user", message);

      // Nhận diện ý định: nếu hỏi về "phiên bản", "tồn kho" và có currentProduct trong context
      const lowerMsg = message.toLowerCase();
      const isAskingVariants =
        (lowerMsg.includes("phiên bản") ||
          lowerMsg.includes("tất cả") ||
          lowerMsg.includes("còn hàng") ||
          lowerMsg.includes("tồn kho")) &&
        session.context &&
        session.context.currentProduct;

      if (isAskingVariants) {
        // Truy xuất thông tin phiên bản từ productId trong context
        const productId = session.context.currentProduct;
        const stockInfo = await productSearchService.checkStock(productId);

        let variantContext = "";
        if (stockInfo.variants && stockInfo.variants.length > 0) {
          variantContext = `${stockInfo.message}\n\n`;
          stockInfo.variants.forEach((v, index) => {
            variantContext += `${index + 1}. RAM ${v.ram}GB / ROM ${v.storage}GB
   - Giá: ${v.price.toLocaleString("vi-VN")}đ
   - Tồn kho: ${v.available ? `Còn ${v.stock} sản phẩm` : "Hết hàng"}
   - Trạng thái: ${v.available ? "✅ Có sẵn" : "❌ Hết hàng"}

`;
          });

          const prompt = `${variantContext}

Câu hỏi của khách hàng: ${message}

Hãy trả lời khách hàng về các phiên bản và tồn kho một cách rõ ràng, ngắn gọn và chuyên nghiệp.`;

          const reply = await this.callGeminiAPI(prompt);
          await session.addMessage("assistant", reply, { stockInfo });

          return {
            success: true,
            message,
            reply,
            variants: stockInfo.variants,
            sessionId: session.sessionId,
          };
        } else if (stockInfo.stock !== undefined) {
          variantContext = `Tồn kho: ${
            stockInfo.available ? `Còn ${stockInfo.stock} sản phẩm` : "Hết hàng"
          }`;

          const prompt = `${variantContext}

Câu hỏi của khách hàng: ${message}

Hãy trả lời khách hàng về tồn kho một cách rõ ràng và ngắn gọn.`;

          const reply = await this.callGeminiAPI(prompt);
          await session.addMessage("assistant", reply, { stockInfo });

          return {
            success: true,
            message,
            reply,
            stock: stockInfo.stock,
            sessionId: session.sessionId,
          };
        }
      }

      // Lấy lịch sử hội thoại (5 tin nhắn gần nhất)
      const recentMessages = session.messages.slice(-5);
      const conversationContext = recentMessages
        .map(
          (msg) =>
            `${msg.role === "user" ? "Khách hàng" : "Bạn"}: ${msg.content}`
        )
        .join("\n");

      // Gọi AI
      const reply = await this.callGeminiAPI(message, conversationContext);

      // Lưu reply
      await session.addMessage("assistant", reply);

      return {
        success: true,
        message,
        reply,
        sessionId: session.sessionId,
      };
    } catch (error) {
      console.error("Error in handleGeneralQuestion:", error);
      throw error;
    }
  }

  /**
   * Xử lý tư vấn sản phẩm (có RAG - truy xuất dữ liệu thực)
   */
  async handleProductInquiry(userId, sessionId, message) {
    try {
      // Lấy hoặc tạo session
      let session = await ChatSession.findOne({ sessionId });
      if (!session) {
        session = new ChatSession({ userId, sessionId });
        await session.save();
      }

      // Thêm message của user
      await session.addMessage("user", message);

      // Khởi tạo context nếu chưa có
      if (!session.context) {
        session.context = {};
      }

      console.log(`\n🔍 [handleProductInquiry] SessionId: ${sessionId}`);
      console.log(`📝 Message: "${message}"`);
      console.log(`💾 Current Context:`, {
        currentProduct: session.context.currentProduct,
        currentProductName: session.context.currentProductName,
        lastIntent: session.context.lastIntent,
      });

      // Nhận diện ý định: nếu hỏi về "phiên bản", "tồn kho", "màu" và có currentProduct trong context
      const lowerMsg = message.toLowerCase();

      // ⭐ ƯU TIÊN HÀNG ĐẦU: XỬ LÝ CÂU HỎI VỀ MÀU SẮC (có tên sản phẩm trong câu)
      const isAskingColorsWithProduct =
        (lowerMsg.includes("màu") ||
          lowerMsg.includes("mau") ||
          lowerMsg.includes("color") ||
          lowerMsg.includes("mầu")) &&
        /\b(iphone|ipad|samsung|galaxy|xiaomi|redmi|oppo|vivo|realme|nokia)/i.test(
          lowerMsg
        );

      if (isAskingColorsWithProduct) {
        console.log(
          `🎨 [COLOR QUERY DETECTED] Phát hiện câu hỏi về màu sắc: "${message}"`
        );

        // Tìm sản phẩm từ câu hỏi
        const products = await productSearchService.searchProducts(message);

        if (products.length === 0) {
          const reply =
            "Xin lỗi, tôi không tìm thấy sản phẩm bạn đang hỏi trong hệ thống.";
          await session.addMessage("assistant", reply);
          return {
            success: false,
            message,
            reply,
            sessionId: session.sessionId,
          };
        }

        const product = products[0]; // Lấy sản phẩm đầu tiên (best match)

        console.log(`📦 [PRODUCT FOUND] ${product.name}`);
        console.log(
          `🎨 [COLOR CHECK] colorVariants: ${
            product.colorVariants?.length || 0
          }, color: ${product.color?.length || 0}`
        );

        let colorContext = `Thông tin về sản phẩm: ${product.name}\n`;
        colorContext += `Giá: ${product.price.toLocaleString("vi-VN")}đ\n\n`;

        // Ưu tiên sử dụng colorVariants (logic mới) trước
        if (product.colorVariants && product.colorVariants.length > 0) {
          console.log(
            `✅ [USING colorVariants] ${product.colorVariants.length} variants found`
          );
          colorContext += `Các màu sắc có sẵn:\n\n`;
          product.colorVariants.forEach((variant, index) => {
            colorContext += `${index + 1}. Màu ${variant.color}`;
            if (variant.colorCode) {
              colorContext += ` (Mã màu: ${variant.colorCode})`;
            }
            colorContext += `\n   - Tồn kho: ${
              variant.stock > 0 ? `Còn ${variant.stock} sản phẩm` : "Hết hàng"
            }`;
            colorContext += `\n   - Trạng thái: ${
              variant.stock > 0 ? "✅ Có sẵn" : "❌ Hết hàng"
            }`;
            if (variant.sku) {
              colorContext += `\n   - Mã SKU: ${variant.sku}`;
            }
            if (variant.images && variant.images.length > 0) {
              colorContext += `\n   - Số lượng ảnh: ${variant.images.length} ảnh`;
            }
            colorContext += `\n\n`;
          });
        }
        // Fallback: sử dụng field color cũ nếu chưa có colorVariants
        else if (product.color && product.color.length > 0) {
          console.log(
            `✅ [USING color field] ${product.color.length} colors found`
          );
          colorContext += `Các màu sắc có sẵn:\n`;
          product.color.forEach((c, index) => {
            colorContext += `${index + 1}. ${c}\n`;
          });
        } else {
          console.log(`❌ [NO COLOR DATA] Product has no color information`);
          colorContext += `Sản phẩm này chưa có thông tin về màu sắc trong hệ thống. Vui lòng liên hệ để được tư vấn thêm.`;
        }

        const prompt = `${colorContext}

Câu hỏi của khách hàng: ${message}

Hãy trả lời khách hàng về các màu sắc có sẵn một cách rõ ràng, ngắn gọn. Nếu màu nào hết hàng thì thông báo rõ ràng.`;

        const reply = await this.callGeminiAPI(prompt);

        // Chuẩn bị dữ liệu colorVariants để trả về
        const colorVariantsData =
          product.colorVariants && product.colorVariants.length > 0
            ? product.colorVariants.map((v) => ({
                color: v.color,
                colorCode: v.colorCode,
                stock: v.stock,
                sku: v.sku,
                images: v.images,
                available: v.stock > 0,
              }))
            : product.color || [];

        await session.addMessage("assistant", reply, {
          productId: product._id,
          productName: product.name,
          colorVariants: colorVariantsData,
        });

        // Lưu vào context để câu hỏi tiếp theo có thể tham chiếu
        session.context.currentProduct = product._id;
        session.context.currentProductName = product.name;
        await session.save();

        return {
          success: true,
          message,
          reply,
          product: {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "/images/placeholder.png",
            colorVariants: colorVariantsData,
            stock: product.stock,
          },
          actions: [
            { type: "add_to_cart", label: "Thêm vào giỏ hàng" },
            { type: "buy_now", label: "Mua ngay" },
            { type: "installment", label: "Mua trả góp" },
          ],
          sessionId: session.sessionId,
        };
      }

      // ⭐ KIỂM TRA CÂU HỎI "CÓ BÁN X KHÔNG" - XỬ LÝ TRỰC TIẾP TỪ DATABASE
      const isAskingAvailability =
        /\b(có|bán|còn)\s+(bán|không|ko|hem|hông)\b/.test(lowerMsg) ||
        /\b(có|còn)\s+[^\s]+\s+(không|ko|hem)\b/.test(lowerMsg) ||
        (lowerMsg.includes("có") &&
          lowerMsg.includes("không") &&
          lowerMsg.split(" ").length <= 10);

      if (isAskingAvailability) {
        console.log(
          "🔍 Phát hiện câu hỏi 'có bán X không' - Kiểm tra database trực tiếp"
        );

        // Tìm sản phẩm trong database
        const products = await productSearchService.searchProducts(message);

        if (products.length > 0) {
          const product = products[0];
          const inStock = product.stock > 0;

          let reply = "";
          if (inStock) {
            reply = `Có ạ! Chúng tôi có bán **${product.name}**.\n\n`;
            reply += `💰 Giá: ${product.price.toLocaleString("vi-VN")}đ`;
            if (product.discount > 0) {
              reply += ` (Giảm ${product.discount}%)`;
            }
            reply += `\n📦 Tồn kho: Còn ${product.stock} sản phẩm\n`;
            reply += `⭐ Đánh giá: ${product.rating}/5 (${product.sold} đã bán)\n\n`;
            reply += `Bạn có muốn xem chi tiết thông số kỹ thuật hoặc đặt hàng không?`;
          } else {
            reply = `Chúng tôi có sản phẩm **${product.name}** trong danh mục, nhưng hiện tại đã hết hàng.\n\n`;
            reply += `💡 Bạn có thể xem các sản phẩm tương tự hoặc để lại thông tin để được thông báo khi có hàng.`;
          }

          await session.addMessage("assistant", reply, {
            productId: product._id,
            productName: product.name,
            checkAvailability: true,
          });

          // Lưu vào context
          session.context.currentProduct = product._id;
          session.context.currentProductName = product.name;
          await session.save();

          // Chuẩn bị dữ liệu colorVariants
          const hasColorVariants =
            product.colorVariants && product.colorVariants.length > 0;
          const colorVariantsData = hasColorVariants
            ? product.colorVariants.map((v) => ({
                color: v.color,
                colorCode: v.colorCode,
                stock: v.stock,
                sku: v.sku,
                images: v.images,
                available: v.stock > 0,
              }))
            : product.color || [];

          return {
            success: true,
            message,
            reply,
            sessionId: session.sessionId,
            product: {
              _id: product._id,
              name: product.name,
              price: product.price,
              discount: product.discount,
              image: product.images?.[0] || "/images/placeholder.png",
              images: product.images,
              rating: product.rating,
              stock: product.stock,
              brand: product.brand,
              colorVariants: colorVariantsData,
            },
            actions: inStock
              ? [
                  { type: "add_to_cart", label: "Thêm vào giỏ hàng" },
                  { type: "buy_now", label: "Mua ngay" },
                  { type: "installment", label: "Mua trả góp" },
                ]
              : [],
          };
        } else {
          // Không tìm thấy sản phẩm trong database - Tìm sản phẩm tương tự
          console.log(
            "❌ Không tìm thấy sản phẩm chính xác, tìm sản phẩm tương tự..."
          );

          // Trích xuất tên brand từ query
          const brandMatch = message.match(
            /(xiaomi|samsung|iphone|apple|oppo|vivo|realme|nokia)/i
          );
          let similarProducts = [];

          if (brandMatch) {
            const brandName = brandMatch[1];
            similarProducts = await Product.find({
              name: { $regex: new RegExp(brandName, "i") },
              stock: { $gt: 0 },
            })
              .populate("brand", "name")
              .limit(5)
              .select("name price stock discount rating");
          }

          let reply = `Xin lỗi, hiện tại chúng tôi chưa có sản phẩm này trong danh mục.`;

          if (similarProducts.length > 0) {
            reply += `\n\n💡 Tuy nhiên, chúng tôi có các sản phẩm tương tự:\n\n`;
            similarProducts.forEach((p, i) => {
              reply += `${i + 1}. **${p.name}**\n`;
              reply += `   - Giá: ${p.price.toLocaleString("vi-VN")}đ`;
              if (p.discount > 0) reply += ` (Giảm ${p.discount}%)`;
              reply += `\n   - Tồn kho: ${p.stock} sản phẩm\n\n`;
            });
            reply += `Bạn có muốn xem chi tiết sản phẩm nào không?`;
          } else {
            reply += `\n\n💡 Bạn có thể:\n- Xem các sản phẩm tương tự\n- Để lại thông tin để được tư vấn\n- Hỏi về sản phẩm khác`;
          }

          await session.addMessage("assistant", reply);

          const response = {
            success: true,
            message,
            reply,
            sessionId: session.sessionId,
          };

          if (similarProducts.length > 0) {
            response.products = similarProducts.map((p) => ({
              _id: p._id,
              name: p.name,
              price: p.price,
              discount: p.discount,
              image: p.images?.[0] || "/images/placeholder.png",
              rating: p.rating,
              stock: p.stock,
            }));
          }

          return response;
        }
      }

      // Kiểm tra xem có đang hỏi về sản phẩm trong context không
      const hasCurrentProduct = session.context.currentProduct;

      // Nhận diện các từ khóa cho câu hỏi follow-up
      const isAskingVariants =
        hasCurrentProduct &&
        (lowerMsg.includes("phiên bản") ||
          lowerMsg.includes("tất cả") ||
          lowerMsg.includes("liệt kê") ||
          lowerMsg.includes("xem") ||
          lowerMsg.includes("còn") ||
          lowerMsg.includes("có") ||
          lowerMsg.includes("bao nhiêu") ||
          /\bcó\s+(những|các|mấy)/.test(lowerMsg));

      const isAskingColors =
        hasCurrentProduct &&
        (lowerMsg.includes("màu") ||
          lowerMsg.includes("mau") ||
          lowerMsg.includes("color") ||
          lowerMsg.includes("mầu"));

      const isAskingStock =
        hasCurrentProduct &&
        (lowerMsg.includes("tồn kho") ||
          lowerMsg.includes("còn hàng") ||
          lowerMsg.includes("sẵn hàng") ||
          lowerMsg.includes("còn không") ||
          lowerMsg.includes("có không"));

      // ⭐ ƯU TIÊN XỬ LÝ CÂU HỎI FOLLOW-UP VỀ SẢN PHẨM TRONG CONTEXT

      // 1. Xử lý câu hỏi về màu sắc (follow-up - có sản phẩm trong context)
      if (isAskingColors) {
        console.log(
          `🎨 Phát hiện câu hỏi về màu sắc, sử dụng context: ${session.context.currentProduct}`
        );

        // Truy xuất thông tin màu sắc từ productId trong context
        const productId = session.context.currentProduct;
        const product = await Product.findById(productId).populate(
          "brand category"
        );

        if (!product) {
          const reply =
            "Xin lỗi, không tìm thấy thông tin sản phẩm bạn đang hỏi.";
          await session.addMessage("assistant", reply);
          return {
            success: false,
            message,
            reply,
            sessionId: session.sessionId,
          };
        }

        let colorContext = `Thông tin về sản phẩm: ${product.name}\n`;
        colorContext += `Giá: ${product.price.toLocaleString("vi-VN")}đ\n\n`;

        // Ưu tiên sử dụng colorVariants (logic mới) trước
        if (product.colorVariants && product.colorVariants.length > 0) {
          colorContext += `Các màu sắc có sẵn:\n\n`;
          product.colorVariants.forEach((variant, index) => {
            colorContext += `${index + 1}. Màu ${variant.color}`;
            if (variant.colorCode) {
              colorContext += ` (Mã màu: ${variant.colorCode})`;
            }
            colorContext += `\n   - Tồn kho: ${
              variant.stock > 0 ? `Còn ${variant.stock} sản phẩm` : "Hết hàng"
            }`;
            colorContext += `\n   - Trạng thái: ${
              variant.stock > 0 ? "✅ Có sẵn" : "❌ Hết hàng"
            }`;
            if (variant.sku) {
              colorContext += `\n   - Mã SKU: ${variant.sku}`;
            }
            if (variant.images && variant.images.length > 0) {
              colorContext += `\n   - Số lượng ảnh: ${variant.images.length} ảnh`;
            }
            colorContext += `\n\n`;
          });
        }
        // Fallback: sử dụng field color cũ nếu chưa có colorVariants
        else if (product.color && product.color.length > 0) {
          colorContext += `Các màu sắc có sẵn:\n`;
          product.color.forEach((c, index) => {
            colorContext += `${index + 1}. ${c}\n`;
          });
        } else {
          colorContext += `Sản phẩm này chưa có thông tin về màu sắc.`;
        }

        const recentMessages = session.messages.slice(-5);
        const conversationContext = recentMessages
          .map(
            (msg) =>
              `${msg.role === "user" ? "Khách hàng" : "Bạn"}: ${msg.content}`
          )
          .join("\n");

        const fullContext = `Lịch sử hội thoại:\n${conversationContext}\n\n${colorContext}`;

        const prompt = `${colorContext}

Câu hỏi của khách hàng: ${message}

Hãy trả lời khách hàng về các màu sắc có sẵn một cách rõ ràng, ngắn gọn. Nếu màu nào hết hàng thì thông báo rõ ràng.`;

        const reply = await this.callGeminiAPI(prompt, fullContext);

        // Chuẩn bị dữ liệu colorVariants để trả về
        const colorVariantsData =
          product.colorVariants && product.colorVariants.length > 0
            ? product.colorVariants.map((v) => ({
                color: v.color,
                colorCode: v.colorCode,
                stock: v.stock,
                sku: v.sku,
                images: v.images,
                available: v.stock > 0,
              }))
            : product.color || [];

        await session.addMessage("assistant", reply, {
          productId,
          productName: product.name,
          colorVariants: colorVariantsData,
        });

        return {
          success: true,
          message,
          reply,
          product: {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "/images/placeholder.png",
            colorVariants: colorVariantsData,
            stock: product.stock,
          },
          actions: [
            { type: "add_to_cart", label: "Thêm vào giỏ hàng" },
            { type: "buy_now", label: "Mua ngay" },
            { type: "installment", label: "Mua trả góp" },
          ],
          sessionId: session.sessionId,
        };
      }

      // 2. Xử lý câu hỏi về phiên bản / tồn kho
      if (isAskingVariants || isAskingStock) {
        console.log(
          `📦 Phát hiện câu hỏi về phiên bản/tồn kho, sử dụng context: ${session.context.currentProduct}`
        );

        // Truy xuất thông tin phiên bản từ productId trong context
        const productId = session.context.currentProduct;
        const product = await Product.findById(productId).populate(
          "brand category"
        );

        if (!product) {
          const reply =
            "Xin lỗi, không tìm thấy thông tin sản phẩm bạn đang hỏi.";
          await session.addMessage("assistant", reply);
          return {
            success: false,
            message,
            reply,
            sessionId: session.sessionId,
          };
        }

        const stockInfo = await productSearchService.checkStock(productId);

        let variantContext = `Thông tin về sản phẩm: ${product.name}\n`;
        variantContext += `Giá cơ bản: ${product.price.toLocaleString(
          "vi-VN"
        )}đ\n\n`;

        if (stockInfo.variants && stockInfo.variants.length > 0) {
          variantContext += `Danh sách các phiên bản:\n\n`;
          stockInfo.variants.forEach((v, index) => {
            variantContext += `${index + 1}. Phiên bản RAM ${v.ram}GB / ROM ${
              v.storage
            }GB
   - Giá: ${v.price.toLocaleString("vi-VN")}đ
   - Tồn kho: ${v.available ? `Còn ${v.stock} sản phẩm` : "Hết hàng"}
   - Trạng thái: ${v.available ? "✅ Có sẵn" : "❌ Hết hàng"}

`;
          });

          const prompt = `${variantContext}

Câu hỏi của khách hàng: ${message}

Hãy trả lời khách hàng về các phiên bản và tồn kho một cách rõ ràng, ngắn gọn, chuyên nghiệp. Đưa ra gợi ý nếu cần.`;

          // Lấy lịch sử hội thoại để AI hiểu ngữ cảnh
          const recentMessages = session.messages.slice(-5);
          const conversationContext = recentMessages
            .map(
              (msg) =>
                `${msg.role === "user" ? "Khách hàng" : "Bạn"}: ${msg.content}`
            )
            .join("\n");

          const fullContext = `Lịch sử hội thoại:\n${conversationContext}\n\n${variantContext}`;

          const reply = await this.callGeminiAPI(prompt, fullContext);
          await session.addMessage("assistant", reply, {
            productId,
            productName: product.name,
            variants: stockInfo.variants,
          });

          return {
            success: true,
            message,
            reply,
            product: {
              _id: product._id,
              name: product.name,
              price: product.price,
              image: product.images?.[0] || "/images/placeholder.png",
              stock: product.stock,
            },
            variants: stockInfo.variants,
            actions: [
              { type: "add_to_cart", label: "Thêm vào giỏ hàng" },
              { type: "buy_now", label: "Mua ngay" },
              { type: "installment", label: "Mua trả góp" },
            ],
            sessionId: session.sessionId,
          };
        } else {
          variantContext += `Tồn kho: ${
            stockInfo.available ? `Còn ${stockInfo.stock} sản phẩm` : "Hết hàng"
          }\n`;
          variantContext += `Sản phẩm này không có phân loại phiên bản riêng biệt.`;

          const prompt = `${variantContext}

Câu hỏi của khách hàng: ${message}

Hãy trả lời khách hàng về tồn kho một cách rõ ràng và ngắn gọn.`;

          // Lấy lịch sử hội thoại để AI hiểu ngữ cảnh
          const recentMessages = session.messages.slice(-5);
          const conversationContext = recentMessages
            .map(
              (msg) =>
                `${msg.role === "user" ? "Khách hàng" : "Bạn"}: ${msg.content}`
            )
            .join("\n");

          const fullContext = `Lịch sử hội thoại:\n${conversationContext}\n\n${variantContext}`;

          const reply = await this.callGeminiAPI(prompt, fullContext);
          await session.addMessage("assistant", reply, {
            productId,
            productName: product.name,
            stock: stockInfo.stock,
          });

          // Chuẩn bị dữ liệu colorVariants
          const hasColorVariants =
            product.colorVariants && product.colorVariants.length > 0;
          const colorVariantsData = hasColorVariants
            ? product.colorVariants.map((v) => ({
                color: v.color,
                colorCode: v.colorCode,
                stock: v.stock,
                sku: v.sku,
                images: v.images,
                available: v.stock > 0,
              }))
            : product.color || [];

          return {
            success: true,
            message,
            reply,
            product: {
              _id: product._id,
              name: product.name,
              price: product.price,
              image: product.images?.[0] || "/images/placeholder.png",
              stock: stockInfo.stock,
              colorVariants: colorVariantsData,
            },
            actions: [
              { type: "add_to_cart", label: "Thêm vào giỏ hàng" },
              { type: "buy_now", label: "Mua ngay" },
              { type: "installment", label: "Mua trả góp" },
            ],
            sessionId: session.sessionId,
          };
        }
      }

      // Tìm sản phẩm phù hợp
      const products = await productSearchService.searchProducts(message);

      // Xây dựng context về sản phẩm
      let productContext = "";
      if (products.length > 0) {
        productContext = "Danh sách sản phẩm phù hợp:\n\n";
        products.forEach((product, index) => {
          productContext += `${index + 1}. ${product.name}
   - Giá: ${product.price.toLocaleString("vi-VN")}đ ${
            product.discount > 0 ? `(Giảm ${product.discount}%)` : ""
          }
   - RAM: ${product.ram}GB, Bộ nhớ: ${product.storage}GB
   - Pin: ${product.battery}mAh
   - Màn hình: ${product.displaySize}" ${product.displayType || ""}
   - Chip: ${product.chipset || "N/A"}
   - Camera: ${product.cameraRear || "N/A"}
   - Thương hiệu: ${product.brand?.name || "N/A"}
   - Đánh giá: ${product.rating}/5 ⭐ (${product.sold} đã bán)
   - Tồn kho: ${product.stock > 0 ? `Còn ${product.stock} máy` : "Hết hàng"}
   - ID: ${product._id}

`;
        });

        // ⭐ LƯU PRODUCTID VÀO CONTEXT - Quan trọng cho câu hỏi follow-up
        session.context.currentProduct = products[0]._id;
        session.context.currentProductName = products[0].name;
        session.context.lastIntent = "product_search";
        session.context.lastUpdate = new Date();
        session.context.filters = await productSearchService.extractFilters(
          message
        );

        // Lưu session với context mới
        await session.save();

        console.log(
          `✅ Đã lưu productId vào context: ${products[0]._id} (${products[0].name})`
        );
      } else {
        // ⭐ QUAN TRỌNG: Xóa context cũ nếu không tìm thấy sản phẩm
        session.context.currentProduct = null;
        session.context.currentProductName = null;
        session.context.lastIntent = "product_not_found";
        await session.save();

        console.log("❌ Không tìm thấy sản phẩm, đã xóa context cũ");

        productContext =
          "Không tìm thấy sản phẩm phù hợp với yêu cầu. Hãy gợi ý khách hàng mở rộng tiêu chí tìm kiếm.";
      }

      // Lấy lịch sử hội thoại để AI hiểu ngữ cảnh
      const recentMessages = session.messages.slice(-5);
      const conversationContext = recentMessages
        .map(
          (msg) =>
            `${msg.role === "user" ? "Khách hàng" : "Bạn"}: ${msg.content}`
        )
        .join("\n");

      const fullContext = `Lịch sử hội thoại:\n${conversationContext}\n\n${productContext}`;

      // Gọi AI với context sản phẩm
      const prompt = `Dựa vào danh sách sản phẩm bên dưới, hãy tư vấn cho khách hàng về những sản phẩm phù hợp nhất. 
Giải thích lý do tại sao các sản phẩm này phù hợp với yêu cầu của khách hàng.
Nếu có nhiều lựa chọn, hãy so sánh ưu nhược điểm của từng sản phẩm.
Nếu không tìm thấy sản phẩm, hãy hỏi thêm để hiểu rõ nhu cầu khách hàng.

${productContext}

Câu hỏi của khách hàng: ${message}`;

      const reply = await this.callGeminiAPI(prompt, fullContext);

      // Lưu reply với metadata
      await session.addMessage("assistant", reply, {
        products: products.map((p) => ({
          id: p._id,
          name: p.name,
          price: p.price,
        })),
      });

      // Chuẩn bị response với product đầu tiên (nếu có) và actions
      const response = {
        success: true,
        message,
        reply,
        sessionId: session.sessionId,
      };

      // Nếu tìm thấy sản phẩm, thêm product và actions
      if (products.length > 0) {
        const firstProduct = products[0];

        // Chuẩn bị dữ liệu colorVariants
        const hasColorVariants =
          firstProduct.colorVariants && firstProduct.colorVariants.length > 0;
        const colorVariantsData = hasColorVariants
          ? firstProduct.colorVariants.map((v) => ({
              color: v.color,
              colorCode: v.colorCode,
              stock: v.stock,
              sku: v.sku,
              images: v.images,
              available: v.stock > 0,
            }))
          : firstProduct.color || [];

        response.product = {
          _id: firstProduct._id,
          name: firstProduct.name,
          price: firstProduct.price,
          discount: firstProduct.discount,
          image: firstProduct.images?.[0] || "/images/placeholder.png",
          images: firstProduct.images,
          rating: firstProduct.rating,
          stock: firstProduct.stock,
          brand: firstProduct.brand,
          ram: firstProduct.ram,
          storage: firstProduct.storage,
          battery: firstProduct.battery,
          displaySize: firstProduct.displaySize,
          chipset: firstProduct.chipset,
          cameraRear: firstProduct.cameraRear,
          colorVariants: colorVariantsData,
        };

        response.actions = [
          { type: "add_to_cart", label: "Thêm vào giỏ hàng" },
          { type: "buy_now", label: "Mua ngay" },
          { type: "installment", label: "Mua trả góp" },
        ];

        // Thêm danh sách sản phẩm nếu có nhiều hơn 1
        if (products.length > 1) {
          response.products = products.map((p) => {
            const hasColorVariants =
              p.colorVariants && p.colorVariants.length > 0;
            const colorVariantsData = hasColorVariants
              ? p.colorVariants.map((v) => ({
                  color: v.color,
                  colorCode: v.colorCode,
                  stock: v.stock,
                  sku: v.sku,
                  images: v.images,
                  available: v.stock > 0,
                }))
              : p.color || [];

            return {
              _id: p._id,
              name: p.name,
              price: p.price,
              discount: p.discount,
              image: p.images?.[0] || "/images/placeholder.png",
              rating: p.rating,
              stock: p.stock,
              colorVariants: colorVariantsData,
            };
          });
        }
      }

      return response;
    } catch (error) {
      console.error("Error in handleProductInquiry:", error);
      throw error;
    }
  }

  /**
   * Xử lý tra cứu đơn hàng
   */
  async handleOrderTracking(userId, sessionId, message, orderId = null) {
    try {
      let session = await ChatSession.findOne({ sessionId });
      if (!session) {
        session = new ChatSession({ userId, sessionId });
        await session.save();
      }

      await session.addMessage("user", message);

      let orderContext = "";
      const lowerMsg = message.toLowerCase();

      // Kiểm tra xem có hỏi về đơn trả góp không
      const isAskingInstallment =
        lowerMsg.includes("trả góp") ||
        lowerMsg.includes("installment") ||
        lowerMsg.includes("đơn góp");

      if (orderId) {
        // Tra cứu đơn hàng cụ thể
        const order = await Order.findById(orderId)
          .populate("customerId", "fullName email phone")
          .populate("items.productId", "name price images");

        if (order) {
          const statusMap = {
            0: "Chờ xác nhận",
            1: "Đã xác nhận",
            2: "Đang giao hàng",
            3: "Đã giao hàng",
            4: "Đã hủy",
          };

          const financeStatusMap = {
            pending: "Đang chờ duyệt",
            approved: "Đã duyệt",
            rejected: "Bị từ chối",
          };

          orderContext = `Thông tin đơn hàng #${order._id}:
- Trạng thái: ${statusMap[order.status]}
- Tổng tiền: ${order.total.toLocaleString("vi-VN")}đ
- Địa chỉ giao: ${order.address}
- Số điện thoại: ${order.phone}
- Phương thức thanh toán: ${
            order.paymentMethod === "cod"
              ? "COD (Thanh toán khi nhận hàng)"
              : order.paymentMethod === "creditCard"
              ? "Trả góp qua thẻ tín dụng"
              : order.paymentMethod === "installment"
              ? "Trả góp qua công ty tài chính"
              : "Chuyển khoản"
          }
- Ngày đặt: ${new Date(order.createdAt).toLocaleDateString("vi-VN")}`;

          // Thêm thông tin trả góp nếu có
          if (order.installment && order.installment.isInstallment) {
            orderContext += `\n\n📋 **Thông tin trả góp:**
- Hình thức: ${
              order.installment.type === "creditCard"
                ? "Thẻ tín dụng 💳"
                : "Công ty tài chính 🏦"
            }
- Trả trước: ${order.installment.upfront.toLocaleString("vi-VN")}đ
- Kỳ hạn: ${order.installment.months} tháng
- Lãi suất: ${order.installment.interestRate}%/tháng
- Trả hàng tháng: ${order.installment.monthlyPayment.toLocaleString("vi-VN")}đ
- Tổng phải trả: ${order.installment.totalPayment.toLocaleString("vi-VN")}đ`;

            if (order.installment.type === "financeCompany") {
              orderContext += `\n- Trạng thái hồ sơ: ${
                financeStatusMap[order.installment.financeStatus] ||
                order.installment.financeStatus
              }`;
            }
          }

          orderContext += `\n\n- Sản phẩm:
${order.items
  .map(
    (item, i) =>
      `  ${i + 1}. ${item.productId.name} x${
        item.quantity
      } - ${item.price.toLocaleString("vi-VN")}đ`
  )
  .join("\n")}`;
        } else {
          orderContext = `Không tìm thấy đơn hàng với ID: ${orderId}`;
        }
      } else if (userId) {
        // Tự động nhận diện trạng thái từ câu hỏi
        const statusKeywords = {
          0: ["chờ xác nhận", "chưa xác nhận", "đang chờ"],
          1: ["đã xác nhận", "xác nhận"],
          2: ["đang giao", "đang vận chuyển", "giao hàng"],
          3: ["đã giao", "giao thành công", "đã nhận"],
          4: ["đã hủy", "hủy", "đơn bị hủy"],
        };

        let detectedStatus = null;
        const lowerMsg = message.toLowerCase();
        for (const [status, keywords] of Object.entries(statusKeywords)) {
          if (keywords.some((kw) => lowerMsg.includes(kw))) {
            detectedStatus = Number(status);
            break;
          }
        }

        const statusMap = {
          0: "Chờ xác nhận",
          1: "Đã xác nhận",
          2: "Đang giao hàng",
          3: "Đã giao hàng",
          4: "Đã hủy",
        };

        let orders = [];
        if (detectedStatus !== null) {
          // Lọc đơn theo trạng thái nhận diện được
          const filter = { customerId: userId, status: detectedStatus };
          if (isAskingInstallment) {
            filter["installment.isInstallment"] = true;
          }
          orders = await Order.find(filter)
            .populate("items.productId", "name")
            .sort({ createdAt: -1 });
        } else {
          // Nếu không nhận diện được, trả về tất cả đơn hàng gần đây
          const filter = { customerId: userId };
          if (isAskingInstallment) {
            filter["installment.isInstallment"] = true;
          }
          orders = await Order.find(filter)
            .populate("items.productId", "name")
            .sort({ createdAt: -1 })
            .limit(5);
        }

        if (orders.length > 0) {
          const financeStatusMap = {
            pending: "Đang chờ duyệt",
            approved: "Đã duyệt",
            rejected: "Bị từ chối",
          };

          orderContext = isAskingInstallment
            ? `Danh sách đơn hàng trả góp của bạn:\n\n`
            : detectedStatus !== null
            ? `Các đơn hàng trạng thái "${statusMap[detectedStatus]}" của bạn:\n\n`
            : `Danh sách đơn hàng gần đây của bạn:\n\n`;

          orders.forEach((order, index) => {
            orderContext += `${index + 1}. Đơn hàng #${order._id}
   - Trạng thái: ${statusMap[order.status]}
   - Tổng tiền: ${order.total.toLocaleString("vi-VN")}đ
   - Ngày đặt: ${new Date(order.createdAt).toLocaleDateString("vi-VN")}
   - Sản phẩm: ${order.items.map((item) => item.productId.name).join(", ")}`;

            // Thêm thông tin trả góp nếu có
            if (order.installment && order.installment.isInstallment) {
              orderContext += `
   - 📋 Trả góp: ${
     order.installment.type === "creditCard"
       ? "Thẻ tín dụng 💳"
       : "Công ty tài chính 🏦"
   }
   - Trả hàng tháng: ${order.installment.monthlyPayment.toLocaleString(
     "vi-VN"
   )}đ x ${order.installment.months} tháng`;

              if (order.installment.type === "financeCompany") {
                orderContext += `
   - Trạng thái hồ sơ: ${
     financeStatusMap[order.installment.financeStatus] ||
     order.installment.financeStatus
   }`;
              }
            }

            orderContext += `\n\n`;
          });
        } else {
          orderContext = isAskingInstallment
            ? "Bạn chưa có đơn hàng trả góp nào."
            : detectedStatus !== null
            ? `Hiện tại bạn không có đơn hàng nào ở trạng thái "${statusMap[detectedStatus]}".`
            : "Bạn chưa có đơn hàng nào.";
        }
      } else {
        orderContext =
          "Vui lòng đăng nhập để tra cứu đơn hàng hoặc cung cấp mã đơn hàng.";
      }

      const prompt = `${orderContext}

Câu hỏi của khách hàng: ${message}

Hãy trả lời khách hàng về thông tin đơn hàng một cách rõ ràng và hữu ích.`;

      const reply = await this.callGeminiAPI(prompt);
      await session.addMessage("assistant", reply);

      return {
        success: true,
        message,
        reply,
        sessionId: session.sessionId,
      };
    } catch (error) {
      console.error("Error in handleOrderTracking:", error);
      throw error;
    }
  }

  /**
   * Gợi ý sản phẩm (recommendations)
   */
  async handleRecommendations(userId, sessionId, message, productId = null) {
    try {
      let session = await ChatSession.findOne({ sessionId });
      if (!session) {
        session = new ChatSession({ userId, sessionId });
        await session.save();
      }

      await session.addMessage("user", message);

      let recommendContext = "";
      let recommendations = [];

      if (productId) {
        // Gợi ý sản phẩm tương tự
        recommendations = await productSearchService.getSimilarProducts(
          productId
        );
        const currentProduct = await Product.findById(productId).populate(
          "brand category"
        );

        if (currentProduct) {
          recommendContext = `Sản phẩm hiện tại: ${
            currentProduct.name
          } (${currentProduct.price.toLocaleString("vi-VN")}đ)

Các sản phẩm tương tự:\n\n`;
          recommendations.forEach((product, index) => {
            recommendContext += `${index + 1}. ${product.name}
   - Giá: ${product.price.toLocaleString("vi-VN")}đ
   - RAM: ${product.ram}GB, Bộ nhớ: ${product.storage}GB
   - Pin: ${product.battery}mAh
   - Đánh giá: ${product.rating}/5 ⭐

`;
          });
        }
      } else {
        // Gợi ý sản phẩm bán chạy / mới nhất
        const [bestSellers, latestProducts] = await Promise.all([
          Product.find({ stock: { $gt: 0 } })
            .populate("brand category")
            .sort({ sold: -1 })
            .limit(3),
          Product.find({ isLatest: true, stock: { $gt: 0 } })
            .populate("brand category")
            .sort({ createdAt: -1 })
            .limit(3),
        ]);

        recommendContext = "📱 SẢN PHẨM BÁN CHẠY:\n\n";
        bestSellers.forEach((product, index) => {
          recommendContext += `${index + 1}. ${
            product.name
          } - ${product.price.toLocaleString("vi-VN")}đ (${
            product.sold
          } đã bán)\n`;
        });

        recommendContext += "\n🆕 SẢN PHẨM MỚI NHẤT:\n\n";
        latestProducts.forEach((product, index) => {
          recommendContext += `${index + 1}. ${
            product.name
          } - ${product.price.toLocaleString("vi-VN")}đ\n`;
        });

        recommendations = [...bestSellers, ...latestProducts];
      }

      const prompt = `${recommendContext}

Câu hỏi của khách hàng: ${message}

Hãy giới thiệu và gợi ý các sản phẩm phù hợp cho khách hàng một cách hấp dẫn.`;

      const reply = await this.callGeminiAPI(prompt);
      await session.addMessage("assistant", reply);

      return {
        success: true,
        message,
        reply,
        recommendations: recommendations.map((p) => ({
          id: p._id,
          name: p.name,
          price: p.price,
          images: p.images,
          rating: p.rating,
        })),
        sessionId: session.sessionId,
      };
    } catch (error) {
      console.error("Error in handleRecommendations:", error);
      throw error;
    }
  }

  /**
   * So sánh sản phẩm
   */
  async handleProductComparison(userId, sessionId, message, productIds = []) {
    try {
      let session = await ChatSession.findOne({ sessionId });
      if (!session) {
        session = new ChatSession({ userId, sessionId });
        await session.save();
      }

      await session.addMessage("user", message);

      if (productIds.length < 2) {
        const reply = "Vui lòng cung cấp ít nhất 2 sản phẩm để so sánh.";
        await session.addMessage("assistant", reply);
        return { success: false, message: reply, sessionId: session.sessionId };
      }

      const comparison = await productSearchService.compareProducts(
        productIds[0],
        productIds[1]
      );

      if (!comparison) {
        const reply =
          "Không thể so sánh các sản phẩm này. Vui lòng kiểm tra lại ID sản phẩm.";
        await session.addMessage("assistant", reply);
        return { success: false, message: reply, sessionId: session.sessionId };
      }

      const [p1, p2] = comparison.products;
      const comparisonContext = `So sánh: ${p1.name} vs ${p2.name}

SẢN PHẨM 1: ${p1.name}
- Giá: ${p1.price.toLocaleString("vi-VN")}đ
- RAM: ${p1.ram}GB | Bộ nhớ: ${p1.storage}GB
- Pin: ${p1.battery}mAh
- Màn hình: ${p1.displaySize}" ${p1.displayType || ""}
- Chip: ${p1.chipset || "N/A"}
- Camera: ${p1.cameraRear || "N/A"}
- Đánh giá: ${p1.rating}/5 ⭐

SẢN PHẨM 2: ${p2.name}
- Giá: ${p2.price.toLocaleString("vi-VN")}đ
- RAM: ${p2.ram}GB | Bộ nhớ: ${p2.storage}GB
- Pin: ${p2.battery}mAh
- Màn hình: ${p2.displaySize}" ${p2.displayType || ""}
- Chip: ${p2.chipset || "N/A"}
- Camera: ${p2.cameraRear || "N/A"}
- Đánh giá: ${p2.rating}/5 ⭐`;

      const prompt = `${comparisonContext}

Câu hỏi của khách hàng: ${message}

Hãy so sánh chi tiết 2 sản phẩm này, phân tích ưu nhược điểm và đưa ra gợi ý cho khách hàng nên chọn sản phẩm nào dựa trên nhu cầu.`;

      const reply = await this.callGeminiAPI(prompt);
      await session.addMessage("assistant", reply);

      return {
        success: true,
        message,
        reply,
        comparison,
        sessionId: session.sessionId,
      };
    } catch (error) {
      console.error("Error in handleProductComparison:", error);
      throw error;
    }
  }

  /**
   * Xử lý tư vấn trả góp
   */
  async handleInstallmentAdvice(userId, sessionId, message) {
    try {
      let session = await ChatSession.findOne({ sessionId });
      if (!session) {
        session = new ChatSession({ userId, sessionId });
        await session.save();
      }

      await session.addMessage("user", message);

      const lowerMsg = message.toLowerCase();

      // Kiểm tra xem có hỏi về chính sách/thông tin chung về trả góp không
      const isAskingPolicy =
        lowerMsg.includes("chính sách") ||
        lowerMsg.includes("thông tin trả góp") ||
        lowerMsg.includes("trả góp như thế nào") ||
        lowerMsg.includes("hình thức trả góp") ||
        lowerMsg.includes("điều kiện trả góp") ||
        lowerMsg.includes("quy trình trả góp") ||
        (!lowerMsg.includes("iphone") &&
          !lowerMsg.includes("samsung") &&
          !lowerMsg.includes("xiaomi") &&
          !lowerMsg.includes("sản phẩm") &&
          !session.context?.currentProduct);

      if (isAskingPolicy) {
        // Trả về thông tin chính sách trả góp chung
        const reply = `📋 **Chính sách trả góp tại Phone Store:**

🔹 **1. Hình thức trả góp:**
   💳 **Thẻ tín dụng:** 
   - Không lãi suất, chỉ chia đều số tiền
   - Cần thẻ tín dụng hợp lệ và đủ hạn mức
   - Xác thực qua OTP ngân hàng khi thanh toán
   
   🏦 **Công ty tài chính:** 
   - Lãi suất từ 1.5% đến 2.5%/tháng tùy kỳ hạn
   - Cần cung cấp hồ sơ: CMND/CCCD, ảnh chân dung, giấy chứng minh thu nhập
   - Xét duyệt trong 1-3 ngày làm việc

🔹 **2. Điều kiện trả góp:**
   - Sản phẩm từ 3 triệu trở lên
   - Khách hàng từ 18 tuổi, có giấy tờ tùy thân hợp lệ
   - Với công ty tài chính: cần xác thực qua điện thoại

🔹 **3. Kỳ hạn trả góp:** 3, 6, 9, 12, 18, 24 tháng

🔹 **4. Lưu ý:**
   - Thông tin minh bạch: số tiền trả trước, trả hàng tháng, lãi suất, tổng phải trả
   - Bảo mật thông tin cá nhân theo quy định
   - Nếu hồ sơ bị từ chối, có thể chọn hình thức khác

💡 Bạn muốn tính trả góp cho sản phẩm nào? Hãy cho tôi biết tên sản phẩm để tư vấn chi tiết!`;

        await session.addMessage("assistant", reply);

        return {
          success: true,
          reply,
          sessionId: session.sessionId,
          intent: "installment_policy",
        };
      }

      // Kiểm tra xem có productId trong context không
      const productId = session.context?.currentProduct;

      // ⭐ KIỂM TRA SỚM: User có đang hỏi về sản phẩm MỚI không
      const hasProductMention =
        /\b(iphone|ipad|samsung galaxy|galaxy|xiaomi|redmi|oppo|vivo|realme|nokia|airpod|tai nghe|headphone|earphone)\s*[\w\s]*\d*/i.test(
          message
        );

      // ⭐ KIỂM TRA: User đang chọn sản phẩm từ danh sách productOptions không?
      const hasProductOptions =
        session.context?.productOptions &&
        session.context.productOptions.length > 0;

      console.log(`🔍 Check hasProductOptions: ${hasProductOptions}`);
      console.log(`🔍 Check hasProductMention: ${hasProductMention}`);
      console.log(`📝 Message: "${message}"`);

      if (hasProductOptions && !hasProductMention) {
        console.log("🔍 User đang chọn từ danh sách productOptions...");

        // Parse số thứ tự (1, 2, 3...) hoặc giá (12500000, 14700000...)
        // Hỗ trợ: "1", "số 1", "phiên bản 1", "12500000"
        const numberMatch = message.match(/(?:số|phiên bản)?\s*(\d+)/i);

        if (numberMatch) {
          const number = parseInt(numberMatch[1]);
          let selectedProduct = null;

          console.log(`🔢 Số nhận được: ${number}`);
          console.log(
            `📋 ProductOptions:`,
            JSON.stringify(session.context.productOptions, null, 2)
          );

          // Kiểm tra xem là số thứ tự hay giá
          if (number >= 1 && number <= session.context.productOptions.length) {
            // Là số thứ tự
            selectedProduct = session.context.productOptions[number - 1];
            console.log(
              `✅ Chọn theo số thứ tự: ${number} → ${selectedProduct.name}`
            );
          } else {
            // Là giá tiền
            selectedProduct = session.context.productOptions.find(
              (p) => p.price === number
            );
            if (selectedProduct) {
              console.log(
                `✅ Chọn theo giá: ${number} → ${selectedProduct.name}`
              );
            } else {
              console.log(`❌ Không tìm thấy sản phẩm với giá ${number}`);
            }
          }

          if (selectedProduct) {
            // Lưu sản phẩm đã chọn vào context
            session.context.currentProduct = selectedProduct._id;
            session.context.currentProductName = selectedProduct.name;
            session.context.productOptions = null; // Xóa productOptions
            await session.save();

            // Tính trả góp
            const months = 12;
            const upfront = 0;
            const interestRate = 2;
            const price = selectedProduct.price;
            const principal = price - upfront;
            const monthlyRate = interestRate / 100;
            const monthlyPayment =
              (principal * monthlyRate) /
              (1 - Math.pow(1 + monthlyRate, -months));
            const totalPayment = monthlyPayment * months + upfront;

            const reply = `📱 **Tư vấn trả góp cho ${selectedProduct.name}**

💰 Giá sản phẩm: ${price.toLocaleString("vi-VN")}đ

🏦 **Trả góp qua công ty tài chính:**
   - Trả trước: ${upfront.toLocaleString("vi-VN")}đ
   - Kỳ hạn: ${months} tháng
   - Lãi suất: ${interestRate}%/tháng
   - 💳 **Trả hàng tháng: ${Math.round(monthlyPayment).toLocaleString(
     "vi-VN"
   )}đ**
   - Tổng phải trả: ${Math.round(totalPayment).toLocaleString("vi-VN")}đ

💳 **Trả góp qua thẻ tín dụng (0% lãi suất):**
   - Trả hàng tháng: ${Math.round(price / months).toLocaleString("vi-VN")}đ
   - Tổng phải trả: ${price.toLocaleString("vi-VN")}đ

📋 Bạn muốn:
1. Thay đổi số tháng trả góp (3, 6, 9, 12, 18, 24 tháng)
2. Thay đổi số tiền trả trước
3. Xem thông tin chi tiết về hình thức trả góp
4. Tạo đơn hàng trả góp ngay`;

            await session.addMessage("assistant", reply, {
              productId: selectedProduct._id,
              productName: selectedProduct.name,
              installment: {
                price,
                months,
                upfront,
                interestRate,
                monthlyPayment: Math.round(monthlyPayment),
                totalPayment: Math.round(totalPayment),
              },
            });

            return {
              success: true,
              reply,
              sessionId: session.sessionId,
              product: {
                _id: selectedProduct._id,
                name: selectedProduct.name,
                price: selectedProduct.price,
                image: selectedProduct.image || "/images/placeholder.png",
                stock: selectedProduct.stock,
              },
              installment: {
                months,
                upfront,
                interestRate,
                monthlyPayment: Math.round(monthlyPayment),
                totalPayment: Math.round(totalPayment),
              },
              actions: [{ type: "installment", label: "Mua trả góp ngay" }],
            };
          } else {
            // Không tìm thấy sản phẩm theo số hoặc giá - Yêu cầu user chọn lại
            const productList = session.context.productOptions
              .map(
                (p, i) =>
                  `${i + 1}. ${p.name} - ${p.price.toLocaleString("vi-VN")}đ${
                    p.stock > 0 ? ` (Còn ${p.stock} sp)` : " (Hết hàng)"
                  }`
              )
              .join("\n");

            const reply = `Xin lỗi, tôi không hiểu lựa chọn của bạn. Vui lòng chọn một trong các sản phẩm sau:\n\n${productList}\n\n💡 Bạn có thể nhập số thứ tự (1, 2, ...) hoặc giá sản phẩm.`;

            await session.addMessage("assistant", reply);

            return {
              success: true,
              reply,
              sessionId: session.sessionId,
              productOptions: session.context.productOptions,
            };
          }
        }
      }

      if (hasProductMention) {
        console.log(
          "🔄 Phát hiện tên sản phẩm mới trong message, tìm kiếm lại..."
        );

        // Tìm sản phẩm từ message
        const products = await productSearchService.searchProducts(message);

        if (products.length === 0) {
          const reply =
            "Vui lòng cho tôi biết sản phẩm bạn muốn trả góp (ví dụ: iPhone 15, Samsung Galaxy S24...) để tư vấn chi tiết.";
          await session.addMessage("assistant", reply);

          return {
            success: true,
            reply,
            sessionId: session.sessionId,
          };
        }

        // Nếu có nhiều sản phẩm tương tự, yêu cầu user chọn
        if (products.length > 1) {
          const productList = products
            .slice(0, 5)
            .map(
              (p, i) =>
                `${i + 1}. ${p.name} - ${p.price.toLocaleString("vi-VN")}đ${
                  p.stock > 0 ? ` (Còn ${p.stock} sp)` : " (Hết hàng)"
                }`
            )
            .join("\n");

          const reply = `Tôi tìm thấy ${products.length} sản phẩm phù hợp. Vui lòng cho tôi biết chính xác sản phẩm nào bạn muốn trả góp:\n\n${productList}\n\n💡 Bạn có thể nhập tên đầy đủ hoặc số thứ tự để tôi tư vấn trả góp chi tiết.`;

          // Lưu productOptions vào context để xử lý sau
          session.context.productOptions = products.slice(0, 5).map((p) => ({
            _id: p._id,
            name: p.name,
            price: p.price,
            image: p.images?.[0] || "/images/placeholder.png",
            stock: p.stock,
          }));
          await session.save();

          await session.addMessage("assistant", reply, {
            productOptions: session.context.productOptions,
          });

          return {
            success: true,
            reply,
            sessionId: session.sessionId,
            productOptions: session.context.productOptions,
          };
        }
        if (products.length > 1) {
          const productList = products
            .slice(0, 5)
            .map(
              (p, i) =>
                `${i + 1}. ${p.name} - ${p.price.toLocaleString("vi-VN")}đ${
                  p.stock > 0 ? ` (Còn ${p.stock} sp)` : " (Hết hàng)"
                }`
            )
            .join("\n");

          const reply = `Tôi tìm thấy ${products.length} sản phẩm phù hợp. Vui lòng cho tôi biết chính xác sản phẩm nào bạn muốn trả góp:\n\n${productList}\n\n💡 Bạn có thể nhập tên đầy đủ hoặc số thứ tự để tôi tư vấn trả góp chi tiết.`;

          await session.addMessage("assistant", reply, {
            productOptions: products.slice(0, 5).map((p) => ({
              _id: p._id,
              name: p.name,
              price: p.price,
            })),
          });

          return {
            success: true,
            reply,
            sessionId: session.sessionId,
            productOptions: products.slice(0, 5).map((p) => ({
              _id: p._id,
              name: p.name,
              price: p.price,
              image: p.images?.[0] || "/images/placeholder.png",
              stock: p.stock,
            })),
          };
        }

        // Lưu sản phẩm đầu tiên vào context (chỉ khi có 1 kết quả duy nhất)
        session.context.currentProduct = products[0]._id;
        session.context.currentProductName = products[0].name;
        await session.save();

        const product = products[0];

        console.log(`✅ Đã cập nhật context: ${product.name} (${product._id})`);

        // Tính trả góp mặc định: 12 tháng, không trả trước, qua công ty tài chính
        const months = 12;
        const upfront = 0;
        const interestRate = 2; // 2%/tháng
        const price = product.price;
        const principal = price - upfront;
        const monthlyRate = interestRate / 100;
        const monthlyPayment =
          (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
        const totalPayment = monthlyPayment * months + upfront;

        const reply = `📱 **Tư vấn trả góp cho ${product.name}**

💰 Giá sản phẩm: ${price.toLocaleString("vi-VN")}đ

🏦 **Trả góp qua công ty tài chính:**
   - Trả trước: ${upfront.toLocaleString("vi-VN")}đ
   - Kỳ hạn: ${months} tháng
   - Lãi suất: ${interestRate}%/tháng
   - 💳 **Trả hàng tháng: ${Math.round(monthlyPayment).toLocaleString(
     "vi-VN"
   )}đ**
   - Tổng phải trả: ${Math.round(totalPayment).toLocaleString("vi-VN")}đ

💳 **Trả góp qua thẻ tín dụng (0% lãi suất):**
   - Trả hàng tháng: ${Math.round(price / months).toLocaleString("vi-VN")}đ
   - Tổng phải trả: ${price.toLocaleString("vi-VN")}đ

📋 Bạn muốn:
1. Thay đổi số tháng trả góp (3, 6, 9, 12, 18, 24 tháng)
2. Thay đổi số tiền trả trước
3. Xem thông tin chi tiết về hình thức trả góp
4. Tạo đơn hàng trả góp ngay`;

        await session.addMessage("assistant", reply, {
          productId: product._id,
          productName: product.name,
          installment: {
            price,
            months,
            upfront,
            interestRate,
            monthlyPayment: Math.round(monthlyPayment),
            totalPayment: Math.round(totalPayment),
          },
        });

        return {
          success: true,
          reply,
          sessionId: session.sessionId,
          product: {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "/images/placeholder.png",
            stock: product.stock,
          },
          installment: {
            months,
            upfront,
            interestRate,
            monthlyPayment: Math.round(monthlyPayment),
            totalPayment: Math.round(totalPayment),
          },
          actions: [{ type: "installment", label: "Mua trả góp ngay" }],
        };
      }

      if (!productId) {
        // Thử tìm sản phẩm từ message
        const products = await productSearchService.searchProducts(message);

        if (products.length === 0) {
          const reply =
            "Vui lòng cho tôi biết sản phẩm bạn muốn trả góp (ví dụ: iPhone 15, Samsung Galaxy S24...) để tư vấn chi tiết.";
          await session.addMessage("assistant", reply);

          return {
            success: true,
            reply,
            sessionId: session.sessionId,
          };
        }

        // Nếu có nhiều sản phẩm tương tự, yêu cầu user chọn
        if (products.length > 1) {
          const productList = products
            .slice(0, 5)
            .map(
              (p, i) =>
                `${i + 1}. ${p.name} - ${p.price.toLocaleString("vi-VN")}đ${
                  p.stock > 0 ? ` (Còn ${p.stock} sp)` : " (Hết hàng)"
                }`
            )
            .join("\n");

          const reply = `Tôi tìm thấy ${products.length} sản phẩm phù hợp. Vui lòng cho tôi biết chính xác sản phẩm nào bạn muốn trả góp:\n\n${productList}\n\n💡 Bạn có thể nhập tên đầy đủ hoặc số thứ tự để tôi tư vấn trả góp chi tiết.`;

          // Lưu productOptions vào context
          session.context.productOptions = products.slice(0, 5).map((p) => ({
            _id: p._id,
            name: p.name,
            price: p.price,
            image: p.images?.[0] || "/images/placeholder.png",
            stock: p.stock,
          }));
          await session.save();

          await session.addMessage("assistant", reply, {
            productOptions: session.context.productOptions,
          });

          return {
            success: true,
            reply,
            sessionId: session.sessionId,
            productOptions: session.context.productOptions,
          };
        }

        // Lưu sản phẩm đầu tiên vào context (chỉ khi có 1 kết quả duy nhất)
        session.context.currentProduct = products[0]._id;
        session.context.currentProductName = products[0].name;
        await session.save();

        const product = products[0];

        // Tính trả góp mặc định: 12 tháng, không trả trước, qua công ty tài chính
        const months = 12;
        const upfront = 0;
        const interestRate = 2; // 2%/tháng
        const price = product.price;
        const principal = price - upfront;
        const monthlyRate = interestRate / 100;
        const monthlyPayment =
          (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
        const totalPayment = monthlyPayment * months + upfront;

        const reply = `📱 **Tư vấn trả góp cho ${product.name}**

💰 Giá sản phẩm: ${price.toLocaleString("vi-VN")}đ

🏦 **Trả góp qua công ty tài chính:**
   - Trả trước: ${upfront.toLocaleString("vi-VN")}đ
   - Kỳ hạn: ${months} tháng
   - Lãi suất: ${interestRate}%/tháng
   - 💳 **Trả hàng tháng: ${Math.round(monthlyPayment).toLocaleString(
     "vi-VN"
   )}đ**
   - Tổng phải trả: ${Math.round(totalPayment).toLocaleString("vi-VN")}đ

💳 **Trả góp qua thẻ tín dụng (0% lãi suất):**
   - Trả hàng tháng: ${Math.round(price / months).toLocaleString("vi-VN")}đ
   - Tổng phải trả: ${price.toLocaleString("vi-VN")}đ

📋 Bạn muốn:
1. Thay đổi số tháng trả góp (3, 6, 9, 12, 18, 24 tháng)
2. Thay đổi số tiền trả trước
3. Xem thông tin chi tiết về hình thức trả góp
4. Tạo đơn hàng trả góp ngay`;

        await session.addMessage("assistant", reply, {
          productId: product._id,
          productName: product.name,
          installment: {
            price,
            months,
            upfront,
            interestRate,
            monthlyPayment: Math.round(monthlyPayment),
            totalPayment: Math.round(totalPayment),
          },
        });

        return {
          success: true,
          reply,
          sessionId: session.sessionId,
          product: {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "/images/placeholder.png",
            stock: product.stock,
          },
          installment: {
            months,
            upfront,
            interestRate,
            monthlyPayment: Math.round(monthlyPayment),
            totalPayment: Math.round(totalPayment),
          },
          actions: [{ type: "installment", label: "Mua trả góp ngay" }],
        };
      }

      // Đã có productId trong context, tính trả góp
      const product = await Product.findById(productId);
      if (!product) {
        const reply = "Không tìm thấy sản phẩm bạn muốn trả góp.";
        await session.addMessage("assistant", reply);

        return {
          success: true,
          reply,
          sessionId: session.sessionId,
        };
      }

      // Phân tích message để lấy số tháng, trả trước
      let months = 12;
      let upfront = 0;
      let type = "financeCompany";

      // Trích xuất số tháng từ message
      if (lowerMsg.includes("3 tháng")) months = 3;
      else if (lowerMsg.includes("6 tháng")) months = 6;
      else if (lowerMsg.includes("9 tháng")) months = 9;
      else if (lowerMsg.includes("12 tháng")) months = 12;
      else if (lowerMsg.includes("18 tháng")) months = 18;
      else if (lowerMsg.includes("24 tháng")) months = 24;

      // Trích xuất số tiền trả trước từ message
      const upfrontMatch = message.match(
        /trả\s*trước\s*(\d[\d,\.]*)|đặt\s*cọc\s*(\d[\d,\.]*)|tiền\s*trước\s*(\d[\d,\.]*)/i
      );
      if (upfrontMatch) {
        const upfrontStr =
          upfrontMatch[1] || upfrontMatch[2] || upfrontMatch[3];
        upfront = parseInt(upfrontStr.replace(/[,\.]/g, ""));
        console.log(
          `💵 Phát hiện tiền trả trước: ${upfront.toLocaleString("vi-VN")}đ`
        );
      }

      // Trích xuất hình thức
      if (
        lowerMsg.includes("thẻ tín dụng") ||
        lowerMsg.includes("credit card")
      ) {
        type = "creditCard";
      }

      const price = product.price;
      const principal = price - upfront;

      let monthlyPayment, totalPayment, interestRate;

      if (type === "creditCard") {
        // Thẻ tín dụng: 0% lãi suất
        monthlyPayment = principal / months;
        totalPayment = monthlyPayment * months + upfront;
        interestRate = 0;

        const reply = `💳 **Trả góp ${product.name} qua thẻ tín dụng:**

💰 Giá sản phẩm: ${price.toLocaleString("vi-VN")}đ
📅 Kỳ hạn: ${months} tháng
💵 Lãi suất: 0%

✅ **Trả hàng tháng: ${Math.round(monthlyPayment).toLocaleString("vi-VN")}đ**
💎 Tổng phải trả: ${Math.round(totalPayment).toLocaleString("vi-VN")}đ

📋 **Yêu cầu:**
- Thẻ tín dụng hợp lệ, đủ hạn mức
- Xác thực qua OTP ngân hàng

Bạn có muốn tạo đơn hàng trả góp ngay không?`;

        await session.addMessage("assistant", reply, {
          productId: product._id,
          installment: {
            type,
            months,
            upfront,
            interestRate,
            monthlyPayment: Math.round(monthlyPayment),
            totalPayment: Math.round(totalPayment),
          },
        });

        return {
          success: true,
          reply,
          sessionId: session.sessionId,
          product: {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "/images/placeholder.png",
            stock: product.stock,
          },
          installment: {
            type,
            months,
            upfront,
            interestRate,
            monthlyPayment: Math.round(monthlyPayment),
            totalPayment: Math.round(totalPayment),
          },
          actions: [{ type: "installment", label: "Mua trả góp ngay" }],
        };
      } else {
        // Công ty tài chính: có lãi suất
        const INTEREST_RATES = {
          3: 1.5,
          6: 1.67,
          9: 1.83,
          12: 2,
          18: 2.17,
          24: 2.33,
        };
        interestRate = INTEREST_RATES[months] || 2;
        const monthlyRate = interestRate / 100;
        monthlyPayment =
          (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
        totalPayment = monthlyPayment * months + upfront;

        const reply = `🏦 **Trả góp ${product.name} qua công ty tài chính:**

💰 Giá sản phẩm: ${price.toLocaleString("vi-VN")}đ
💵 Trả trước: ${upfront.toLocaleString("vi-VN")}đ
📅 Kỳ hạn: ${months} tháng
📊 Lãi suất: ${interestRate}%/tháng (${(interestRate * 12).toFixed(2)}%/năm)

✅ **Trả hàng tháng: ${Math.round(monthlyPayment).toLocaleString("vi-VN")}đ**
💎 Tổng phải trả: ${Math.round(totalPayment).toLocaleString("vi-VN")}đ

📋 **Yêu cầu:**
- CMND/CCCD, ảnh chân dung
- Giấy tờ chứng minh thu nhập
- Xét duyệt trong 1-3 ngày

Bạn có muốn:
1. Thay đổi kỳ hạn (3, 6, 9, 12, 18, 24 tháng)
2. Trả góp qua thẻ tín dụng (0% lãi)
3. Tạo đơn hàng trả góp ngay`;

        await session.addMessage("assistant", reply, {
          productId: product._id,
          installment: {
            type,
            months,
            upfront,
            interestRate,
            monthlyPayment: Math.round(monthlyPayment),
            totalPayment: Math.round(totalPayment),
          },
        });

        return {
          success: true,
          reply,
          sessionId: session.sessionId,
          product: {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "/images/placeholder.png",
            stock: product.stock,
          },
          installment: {
            type,
            months,
            upfront,
            interestRate,
            monthlyPayment: Math.round(monthlyPayment),
            totalPayment: Math.round(totalPayment),
          },
          actions: [{ type: "installment", label: "Mua trả góp ngay" }],
        };
      }
    } catch (error) {
      console.error("Error in handleInstallmentAdvice:", error);
      throw error;
    }
  }

  /**
   * Xử lý action từ user (thêm giỏ hàng, mua ngay, trả góp...)
   */
  async handleUserAction(userId, sessionId, action, data) {
    try {
      let session = await ChatSession.findOne({ sessionId });
      if (!session) {
        session = new ChatSession({ userId, sessionId });
        await session.save();
      }

      const { productId, variantId, quantity = 1 } = data;

      switch (action) {
        case "add_to_cart":
          return await this.handleAddToCart(
            userId,
            sessionId,
            productId,
            variantId,
            quantity
          );

        case "buy_now":
          return await this.handleBuyNow(
            userId,
            sessionId,
            productId,
            variantId,
            quantity,
            data
          );

        case "installment":
          return await this.handleInstallmentRequest(
            userId,
            sessionId,
            productId,
            variantId,
            data
          );

        default:
          return {
            success: false,
            reply: "Action không hợp lệ.",
            sessionId,
          };
      }
    } catch (error) {
      console.error("Error in handleUserAction:", error);
      throw error;
    }
  }

  /**
   * Xử lý thêm vào giỏ hàng
   * @param {string} userId - ID người dùng
   * @param {string} productId - ID sản phẩm
   * @param {object} variant - Thông tin variant (color, memory, etc.)
   */
  async handleAddToCart(userId, productId, variant = {}) {
    try {
      if (!userId) {
        return {
          success: false,
          message: "Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.",
          requireAuth: true,
        };
      }

      if (!productId) {
        return {
          success: false,
          message: "Thiếu thông tin sản phẩm.",
        };
      }

      const product = await Product.findById(productId);
      if (!product) {
        return {
          success: false,
          message: "Không tìm thấy sản phẩm.",
        };
      }

      // Kiểm tra xem sản phẩm có variants không
      // Ưu tiên colorVariants (logic mới) trước, fallback sang color (logic cũ)
      const hasColorVariants =
        product.colorVariants && product.colorVariants.length > 0;
      const hasColors =
        hasColorVariants || (product.color && product.color.length > 0);
      const hasStorage = product.storage && product.storage > 0;

      // Kiểm tra xem có cần chọn variant không
      const needsColorSelection = hasColors && !variant?.color;
      const needsStorageSelection = hasStorage && !variant?.storage;
      const needsVariantSelection =
        needsColorSelection || needsStorageSelection;

      if (needsVariantSelection) {
        // Trả về thông tin để FE hiển thị form chọn variant
        const colorVariantsData = hasColorVariants
          ? product.colorVariants.map((v) => ({
              color: v.color,
              colorCode: v.colorCode,
              stock: v.stock,
              sku: v.sku,
              images: v.images,
              available: v.stock > 0,
            }))
          : product.color || [];

        return {
          success: false,
          requireVariant: true,
          message: "Vui lòng chọn cấu hình sản phẩm",
          product: {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "/images/placeholder.png",
          },
          variants: {
            colorVariants: colorVariantsData,
            storage: hasStorage ? [product.storage] : [],
            ram: product.ram ? [product.ram] : [],
          },
        };
      }

      // Nếu đã có đầy đủ variant, thêm vào giỏ hàng
      const Cart = require("../models/Cart");

      let cart = await Cart.findOne({ customerId: userId });

      if (!cart) {
        // Tạo giỏ hàng mới với item đầu tiên
        cart = new Cart({
          customerId: userId,
          items: [{ productId, quantity: 1, variant }],
        });
      } else {
        // Tìm item theo productId và variant (so sánh sâu - giống cartController)
        const itemIndex = cart.items.findIndex(
          (item) =>
            item.productId.toString() === productId &&
            JSON.stringify(item.variant) === JSON.stringify(variant)
        );

        if (itemIndex > -1) {
          // Nếu đã có, tăng số lượng
          cart.items[itemIndex].quantity += 1;
        } else {
          // Nếu chưa có, thêm mới
          cart.items.push({ productId, quantity: 1, variant });
        }
      }

      await cart.save();

      return {
        success: true,
        message: `Đã thêm ${product.name} ${
          variant.color ? `- ${variant.color}` : ""
        } ${variant.storage ? `- ${variant.storage}GB` : ""} vào giỏ hàng!`,
        product: {
          _id: product._id,
          name: product.name,
          price: product.price,
        },
        variant,
        cartItemCount: cart.items.length,
      };
    } catch (error) {
      console.error("Error in handleAddToCart:", error);
      throw error;
    }
  }
  /**
   * Xử lý mua ngay
   */
  async handleBuyNow(
    userId,
    sessionId,
    productId,
    variant = {},
    quantity = 1,
    data = {}
  ) {
    try {
      if (!userId) {
        return {
          success: false,
          message: "Vui lòng đăng nhập để mua hàng.",
          requireAuth: true,
        };
      }

      if (!productId) {
        return {
          success: false,
          message: "Thiếu thông tin sản phẩm.",
        };
      }

      const product = await Product.findById(productId);
      if (!product) {
        return {
          success: false,
          message: "Không tìm thấy sản phẩm.",
        };
      }

      // Kiểm tra xem sản phẩm có variants không
      // Ưu tiên colorVariants (logic mới) trước, fallback sang color (logic cũ)
      const hasColorVariants =
        product.colorVariants && product.colorVariants.length > 0;
      const hasColors =
        hasColorVariants || (product.color && product.color.length > 0);
      const hasStorage = product.storage && product.storage > 0;

      // Kiểm tra xem có cần chọn variant không
      const needsColorSelection = hasColors && !variant?.color;
      const needsStorageSelection = hasStorage && !variant?.storage;
      const needsVariantSelection =
        needsColorSelection || needsStorageSelection;

      if (needsVariantSelection) {
        const colorVariantsData = hasColorVariants
          ? product.colorVariants.map((v) => ({
              color: v.color,
              colorCode: v.colorCode,
              stock: v.stock,
              sku: v.sku,
              images: v.images,
              available: v.stock > 0,
            }))
          : product.color || [];

        return {
          success: false,
          requireVariant: true,
          message: "Vui lòng chọn cấu hình sản phẩm",
          product: {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "/images/placeholder.png",
          },
          variants: {
            colorVariants: colorVariantsData,
            storage: hasStorage ? [product.storage] : [],
            ram: product.ram ? [product.ram] : [],
          },
        };
      }

      // Lấy thông tin khách hàng từ database
      const User = require("../models/User");
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          message: "Không tìm thấy thông tin người dùng.",
        };
      }

      // Lấy thông tin từ data hoặc từ user profile
      let address = data?.address || user.address;
      let phone = data?.phone || user.phone;

      // Kiểm tra nếu vẫn thiếu thông tin
      if (!address || !phone) {
        const missingFields = [];
        if (!address) missingFields.push("address");
        if (!phone) missingFields.push("phone");

        return {
          success: false,
          message: `Vui lòng cập nhật ${missingFields.join(
            ", "
          )} để hoàn tất đơn hàng.`,
          missingFields,
        };
      }

      // TODO: Tạo đơn hàng thực tế
      // const Order = require("../models/Order");
      // const order = await Order.create({ ... });

      return {
        success: true,
        message: `Đơn hàng ${product.name} đã được tạo thành công!`,
        order: {
          productId: product._id,
          productName: product.name,
          quantity,
          total: product.price * quantity,
          address,
          phone,
          customerName: user.name || user.email,
        },
      };
    } catch (error) {
      console.error("Error in handleBuyNow:", error);
      throw error;
    }
  }

  /**
   * Xử lý yêu cầu trả góp
   */
  async handleInstallmentRequest(
    userId,
    sessionId,
    productId,
    variant = {},
    installmentInfo = {}
  ) {
    try {
      if (!userId) {
        return {
          success: false,
          message: "Vui lòng đăng nhập để sử dụng tính năng trả góp.",
          requireAuth: true,
        };
      }

      if (!productId) {
        return {
          success: false,
          message: "Thiếu thông tin sản phẩm.",
        };
      }

      const product = await Product.findById(productId);
      if (!product) {
        return {
          success: false,
          message: "Không tìm thấy sản phẩm.",
        };
      }

      // Kiểm tra xem sản phẩm có variants không
      const hasColors = product.color && product.color.length > 0;
      const hasStorage = product.storage && product.storage > 0;

      // Kiểm tra xem có cần chọn variant không
      const needsColorSelection = hasColors && !variant?.color;
      const needsStorageSelection = hasStorage && !variant?.storage;
      const needsVariantSelection =
        needsColorSelection || needsStorageSelection;

      if (needsVariantSelection) {
        return {
          success: false,
          requireVariant: true,
          message: "Vui lòng chọn cấu hình sản phẩm",
          product: {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "/images/placeholder.png",
          },
          variants: {
            colors: hasColors ? product.color : [],
            storage: hasStorage ? [product.storage] : [],
            ram: product.ram ? [product.ram] : [],
          },
        };
      }

      // Lấy thông tin khách hàng từ database
      const User = require("../models/User");
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          message: "Không tìm thấy thông tin người dùng.",
        };
      }

      // Kiểm tra thông tin trả góp
      const { term, paymentMethod } = installmentInfo;
      const address = user.address;
      const phone = user.phone;

      // Kiểm tra thông tin bắt buộc
      const missingFields = [];
      if (!term) missingFields.push("term");
      if (!paymentMethod) missingFields.push("paymentMethod");
      if (!address) missingFields.push("address");
      if (!phone) missingFields.push("phone");

      if (missingFields.length > 0) {
        return {
          success: false,
          message: `Vui lòng cung cấp ${missingFields.join(
            ", "
          )} để hoàn tất trả góp.`,
          missingFields,
        };
      }

      // TODO: Tạo đơn trả góp thực tế
      // const Order = require("../models/Order");
      // const order = await Order.create({ ... });

      const price = product.price;
      const monthlyPayment =
        paymentMethod === "credit_card" ? price / term : (price * 1.02) / term; // 2% lãi suất ước tính

      return {
        success: true,
        message: `Đơn trả góp ${product.name} đã được tạo thành công!`,
        order: {
          productId: product._id,
          productName: product.name,
          total: price,
          installment: {
            term,
            paymentMethod,
            monthlyPayment: Math.round(monthlyPayment),
          },
          address,
          phone,
          customerName: user.name || user.email,
        },
      };
    } catch (error) {
      console.error("Error in handleInstallmentRequest:", error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử chat
   */
  async getChatHistory(sessionId) {
    try {
      const session = await ChatSession.findOne({ sessionId });
      if (!session) {
        return { success: false, message: "Session không tồn tại" };
      }

      return {
        success: true,
        sessionId: session.sessionId,
        messages: session.messages,
        context: session.context,
      };
    } catch (error) {
      console.error("Error getting chat history:", error);
      throw error;
    }
  }
}

module.exports = new ChatService();
