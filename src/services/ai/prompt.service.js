/**
 * Prompt Service - Tạo prompt chuẩn cho từng nghiệp vụ
 * Centralized prompt management
 */

class PromptService {
  constructor() {
    this.baseSystemPrompt = `Bạn là trợ lý tư vấn bán hàng chuyên nghiệp của cửa hàng điện thoại Phone Store.

🏪 CONTEXT QUAN TRỌNG:
- Phone Store là cửa hàng bán ĐIỆN THOẠI, TABLET, PHỤ KIỆN (tai nghe, sạc, ốp lưng...)
- KHÔNG bán máy chơi game console (PlayStation, Xbox, Nintendo Switch...)
- KHÔNG bán laptop, PC, camera riêng biệt

📱 KHI KHÁCH HỎI:
- "máy chơi game" → Hiểu là ĐIỆN THOẠI CHƠI GAME (gaming phone)
- "máy chụp ảnh" → Hiểu là ĐIỆN THOẠI CAMERA TỐT (camera phone)
- "máy pin trâu" → Hiểu là ĐIỆN THOẠI PIN KHỦNG (long battery phone)
- Nếu khách hỏi sản phẩm NGOÀI phạm vi (PlayStation, laptop...) → Lịch sự giải thích chỉ bán điện thoại

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

⚠️ QUY TẮC BẮT BUỘC (STRICT MODE):
1. CHỈ tư vấn các sản phẩm CÓ TRONG DANH SÁCH được cung cấp
2. TUYỆT ĐỐI KHÔNG được bịa đặt, tưởng tượng, hoặc đề xuất sản phẩm KHÔNG CÓ trong danh sách
3. TUYỆT ĐỐI KHÔNG được sử dụng kiến thức bên ngoài để gợi ý tên sản phẩm, model, hoặc giá
4. Nếu danh sách trống hoặc không tìm thấy sản phẩm phù hợp, hãy lịch sự thông báo và hỏi thêm thông tin
5. Khi khách hỏi về sản phẩm không có, đừng gợi ý sản phẩm tương tự NGOÀI danh sách

❌ CẤM TUYỆT ĐỐI:
- Đề cập bất kỳ tên sản phẩm nào KHÔNG CÓ trong danh sách (ví dụ: Redmi Note 11 Pro, Realme 9 Pro, Galaxy A32...)
- Nói "có thể có sản phẩm X" nếu X không có trong danh sách
- Dùng kiến thức của bạn về sản phẩm ngoài hệ thống để tư vấn`;
  }

  /**
   * Tạo prompt cho product inquiry
   * @param {Array} products
   * @param {string} message
   * @param {string} conversationContext
   * @param {boolean} isAskingColors - Có phải đang hỏi về màu sắc không
   * @returns {string}
   */
  createProductInquiryPrompt(
    products,
    message,
    conversationContext = "",
    isAskingColors = false
  ) {
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

        // Xử lý thông tin màu sắc
        let colorInfo = "";
        if (product.colorVariants && product.colorVariants.length > 0) {
          const colors = product.colorVariants
            .map(
              (v) =>
                `${v.color} (${v.colorCode}, còn ${v.stock || 0} máy, sku: ${
                  v.sku
                })`
            )
            .join(", ");
          colorInfo = `   - Màu sắc: ${colors}\n`;
        } else if (product.color && product.color.length > 0) {
          colorInfo = `   - Màu sắc: ${product.color.join(", ")}\n`;
        }

        productContext += `${index + 1}. ${product.name}
   - Giá gốc: ${originalPrice.toLocaleString("vi-VN")}đ
   ${
     discount > 0
       ? `- Giảm giá: ${discount}% → GIÁ SAU GIẢM: ${finalPrice.toLocaleString(
           "vi-VN"
         )}đ`
       : `- Giá hiện tại: ${finalPrice.toLocaleString("vi-VN")}đ`
   }
${colorInfo}   - RAM: ${product.ram}GB, Bộ nhớ: ${product.storage}GB
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
      productContext = `❌ KHÔNG TÌM THẤY SẢN PHẨM PHÙ HỢP TRONG HỆ THỐNG ❌

⚠️ CHỈ THỊ BẮT BUỘC:
- TUYỆT ĐỐI KHÔNG được đề xuất bất kỳ tên sản phẩm cụ thể nào (như Xiaomi, Realme, Samsung model nào đó)
- KHÔNG được bịa đặt giá, thông số kỹ thuật
- KHÔNG được sử dụng kiến thức của bạn về các sản phẩm ngoài hệ thống
- Chỉ được thông báo rằng không tìm thấy sản phẩm phù hợp và hỏi thêm thông tin

Hãy trả lời kiểu: "Xin lỗi, chúng tôi hiện không tìm thấy sản phẩm phù hợp với yêu cầu của bạn trong hệ thống. Bạn có thể cho mình biết thêm về nhu cầu sử dụng hoặc thương hiệu bạn quan tâm để mình tư vấn chính xác hơn không?"`;
    }

    const fullContext = conversationContext
      ? `Lịch sử hội thoại:\n${conversationContext}\n\n${productContext}`
      : productContext;

    // Nếu đang hỏi về màu sắc, thêm hướng dẫn đặc biệt
    const colorInstruction = isAskingColors
      ? `\n\nQUAN TRỌNG VỀ MÀU SẮC: Khách hàng đang hỏi về màu sắc. Hãy trả lời CỤ THỂ các màu có sẵn từ danh sách trên, kèm tồn kho và mã màu nếu có. TUYỆT ĐỐI KHÔNG nói chung chung kiểu "tôi không có thông tin".\n`
      : "";

    // Instruction về việc đưa ra sản phẩm thay vì hỏi thêm
    const productListInstruction =
      products.length > 0
        ? `\n\n🎯 QUAN TRỌNG - ĐƯA RA SẢN PHẨM NGAY:
- Đã có ${products.length} sản phẩm phù hợp trong danh sách
- ĐỪNG HỎI THÊM THÔNG TIN nữa (đã đủ để tư vấn)
- HÃY TƯ VẤN CỤ THỂ các sản phẩm này ngay, giải thích tại sao phù hợp
- So sánh ưu nhược điểm nếu có nhiều lựa chọn
- Gợi ý sản phẩm TỐT NHẤT cho nhu cầu của khách\n`
        : "";

    return `🚨 CHỈ THỊ BẮT BUỘC - ĐỌC KỸ TRƯỚC KHI TRẢ LỜI:

1. CHỈ được đề cập đến các sản phẩm CÓ TRONG DANH SÁCH bên dưới
2. KHÔNG được sử dụng tên sản phẩm NGOÀI danh sách
3. KHÔNG được bịa đặt giá hoặc thông số kỹ thuật
4. Nếu danh sách trống → CHỈ được nói "không tìm thấy" và hỏi thêm thông tin
${productListInstruction}${colorInstruction}
KHI TRẢ LỜI VỀ GIÁ: 
- Phải dùng CHÍNH XÁC số tiền trong danh sách, không làm tròn, không ước lượng
- Nếu có giảm giá, LUÔN nói giá SAU GIẢM (GIÁ SAU GIẢM) là giá khách phải trả
- Có thể đề cập giá gốc và % giảm để khách thấy ưu đãi

═══════════════════════════════════════════
DANH SÁCH SẢN PHẨM CÓ SẴN TRONG HỆ THỐNG:
═══════════════════════════════════════════

${productContext}

═══════════════════════════════════════════
Câu hỏi của khách hàng: ${message}

⚠️ NHỚ: Chỉ tư vấn sản phẩm TRONG danh sách ở trên. Không được đề xuất sản phẩm khác!`;
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
