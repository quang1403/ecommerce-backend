/**
 * Prompt Service - Tạo prompt chuẩn cho từng nghiệp vụ
 * Centralized prompt management
 */

class PromptService {
  constructor() {
    this.baseSystemPrompt = `Bạn là trợ lý tư vấn bán hàng chuyên nghiệp của cửa hàng điện thoại Phone Store.

Nhiệm vụ của bạn:
- Tư vấn điện thoại, phụ kiện phù hợp với nhu cầu khách hàng
- Giải đáp thắc mắc về sản phẩm, thông số kỹ thuật, giá cả
- Hướng dẫn so sánh sản phẩm
- Tra cứu đơn hàng và thông tin bảo hành
- Giới thiệu chương trình khuyến mãi
- Hỗ trợ đặt hàng

Phong cách giao tiếp:
- Thân thiện, nhiệt tình và chuyên nghiệp
- Trả lời ngắn gọn, súc tích, dễ hiểu
- Đưa ra gợi ý cụ thể khi khách hàng chưa rõ nhu cầu
- Luôn hỏi thêm thông tin nếu cần để tư vấn chính xác hơn

QUAN TRỌNG: Chỉ tư vấn các sản phẩm CÓ TRONG DANH SÁCH bên dưới. Không bịa đặt hoặc giới thiệu sản phẩm không có sẵn.`;
  }

  /**
   * Tạo prompt cho product inquiry
   * @param {Array} products
   * @param {string} message
   * @param {string} conversationContext
   * @returns {string}
   */
  createProductInquiryPrompt(products, message, conversationContext = "") {
    let productContext = "";

    if (products.length > 0) {
      productContext = "Danh sách sản phẩm phù hợp:\n\n";
      products.forEach((product, index) => {
        // Tính giá sau giảm
        const originalPrice = product.price;
        const discount = product.discount || 0;
        const finalPrice =
          discount > 0
            ? Math.round(originalPrice * (1 - discount / 100))
            : originalPrice;

        productContext += `${index + 1}. ${product.name}
   - Giá gốc: ${originalPrice.toLocaleString("vi-VN")}đ
   ${
     discount > 0
       ? `- Giảm giá: ${discount}% → GIÁ SAU GIẢM: ${finalPrice.toLocaleString(
           "vi-VN"
         )}đ`
       : `- Giá hiện tại: ${finalPrice.toLocaleString("vi-VN")}đ`
   }
   - RAM: ${product.ram}GB, Bộ nhớ: ${product.storage}GB
   - Pin: ${product.battery}mAh
   - Màn hình: ${product.displaySize}" ${product.displayType || ""}
   - Chip: ${product.chipset || "N/A"}
   - Camera: ${product.cameraRear || "N/A"}
   - Thương hiệu: ${product.brand?.name || "N/A"}
   - Đánh giá: ${product.rating}/5 ⭐ (${product.sold} đã bán)
   - Tồn kho: ${product.stock > 0 ? `Còn ${product.stock} máy` : "Hết hàng"}

`;
      });
    } else {
      productContext =
        "KHÔNG TÌM THẤY SẢN PHẨM TRONG HỆ THỐNG. TUYỆT ĐỐI KHÔNG ĐƯỢC bịa đặt giá hoặc thông tin sản phẩm. Hãy lịch sự thông báo khách hàng rằng sản phẩm này chưa có trong kho và gợi ý họ hỏi về sản phẩm khác.";
    }

    const fullContext = conversationContext
      ? `Lịch sử hội thoại:\n${conversationContext}\n\n${productContext}`
      : productContext;

    return `QUAN TRỌNG: Bạn PHẢI sử dụng CHÍNH XÁC thông tin giá, RAM, bộ nhớ, pin từ danh sách sản phẩm bên dưới. TUYỆT ĐỐI KHÔNG được bịa đặt hoặc ước lượng giá.

Dựa vào danh sách sản phẩm bên dưới, hãy tư vấn cho khách hàng về những sản phẩm phù hợp nhất. 
Giải thích lý do tại sao các sản phẩm này phù hợp với yêu cầu của khách hàng.
Nếu có nhiều lựa chọn, hãy so sánh ưu nhược điểm của từng sản phẩm.
Nếu không tìm thấy sản phẩm, hãy hỏi thêm để hiểu rõ nhu cầu khách hàng.

KHI TRẢ LỜI VỀ GIÁ: 
- Phải dùng CHÍNH XÁC số tiền trong danh sách, không làm tròn, không ước lượng.
- Nếu có giảm giá, LUÔN nói giá SAU GIẢM (GIÁ SAU GIẢM) là giá khách phải trả.
- Có thể đề cập giá gốc và % giảm để khách thấy ưu đãi.

${productContext}

Câu hỏi của khách hàng: ${message}`;
  }

  /**
   * Tạo prompt cho product comparison
   * @param {Array} products
   * @param {string} message
   * @returns {string}
   */
  createComparePrompt(products, message) {
    if (products.length < 2) {
      return null;
    }

    const [p1, p2] = products;
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

    return `${comparisonContext}

Câu hỏi của khách hàng: ${message}

Hãy so sánh chi tiết 2 sản phẩm này, phân tích ưu nhược điểm và đưa ra gợi ý cho khách hàng nên chọn sản phẩm nào dựa trên nhu cầu.`;
  }

  /**
   * Tạo prompt cho order tracking
   * @param {string} orderContext
   * @param {string} message
   * @returns {string}
   */
  createOrderTrackingPrompt(orderContext, message) {
    return `${orderContext}

Câu hỏi của khách hàng: ${message}

Hãy trả lời khách hàng về thông tin đơn hàng một cách rõ ràng và hữu ích.`;
  }

  /**
   * Tạo prompt cho recommendations
   * @param {string} recommendContext
   * @param {string} message
   * @returns {string}
   */
  createRecommendationPrompt(recommendContext, message) {
    return `${recommendContext}

Câu hỏi của khách hàng: ${message}

Hãy gợi ý những sản phẩm phù hợp nhất với nhu cầu của khách hàng. Giải thích rõ lý do tại sao những sản phẩm này phù hợp.`;
  }

  /**
   * Tạo prompt cho general questions
   * @param {string} message
   * @param {string} conversationContext
   * @returns {string}
   */
  createGeneralPrompt(message, conversationContext = "") {
    const context = conversationContext
      ? `Lịch sử hội thoại:\n${conversationContext}\n\n`
      : "";

    return `${context}Câu hỏi của khách hàng: ${message}

Hãy trả lời câu hỏi của khách hàng một cách thân thiện và chuyên nghiệp. Nếu có liên quan đến sản phẩm, hãy yêu cầu khách hàng cung cấp thêm thông tin cụ thể.`;
  }

  /**
   * Tạo system prompt với product list
   * @param {string} productListContext
   * @returns {string}
   */
  createSystemPromptWithProducts(productListContext) {
    return this.baseSystemPrompt + productListContext;
  }

  /**
   * Tạo installment policy prompt
   * @returns {string}
   */
  createInstallmentPolicyPrompt() {
    return `📋 **Chính sách trả góp tại Phone Store:**

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
  }
}

module.exports = PromptService;
