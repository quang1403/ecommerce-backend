/**
 * Intent Service - Nhận diện loại câu hỏi (intent)
 * Tách từ detectIntent cũ để dễ maintain và test
 */

class IntentService {
  constructor() {
    this.intentPatterns = {
      // Tra cứu đơn hàng
      order_tracking: [
        /đơn hàng/i,
        /order/i,
        /tra cứu/i,
        /tracking/i,
        /theo dõi/i,
        /kiểm tra đơn/i,
      ],

      // So sánh sản phẩm - CẦN CÓ 2 SẢN PHẨM HOẶC TỪ KHÓA RÕ RÀNG
      compare: [
        /so sánh/i,
        /khác nhau/i,
        /compare/i,
        /giống/i,
        / vs /i,
        / versus /i,
      ],

      // Kiểm tra tồn kho
      check_stock: [
        /tồn kho/i,
        /còn hàng/i,
        /stock/i,
        /available/i,
        /còn bao nhiêu/i,
        /sẵn hàng/i,
      ],

      // Trả góp
      installment: [
        /trả góp/i,
        /installment/i,
        /góp/i,
        /lãi suất/i,
        /kỳ hạn/i,
        /thẻ tín dụng/i,
        /công ty tài chính/i,
        /chính sách trả góp/i,
        /mua trả góp/i,
        /hỗ trợ trả góp/i,
      ],

      // Gợi ý sản phẩm
      recommendations: [
        /gợi ý/i,
        /recommend/i,
        /nên mua/i,
        /phù hợp/i,
        /tư vấn mua/i,
        /chọn/i,
      ],

      // Tư vấn sản phẩm (hỏi về sản phẩm cụ thể)
      product_inquiry: [
        /sản phẩm/i,
        /điện thoại/i,
        /phone/i,
        /iphone/i,
        /ipad/i,
        /samsung/i,
        /xiaomi/i,
        /oppo/i,
        /vivo/i,
        /realme/i,
        /nokia/i,
        /tai nghe/i,
        /airpod/i,
        /headphone/i,
        /giá/i,
      ],
    };

    // Patterns nhận diện sản phẩm mới - Mở rộng cho tai nghe và tablet
    this.productMentionPattern =
      /\b(iphone|ipad|samsung galaxy|galaxy|xiaomi|redmi|oppo|vivo|realme|nokia|airpod|ap|a\.p\.|tai nghe|headphone|earphone|earbud|máy tính bảng|tablet)\s*[\w\s]*\d*/i;
  }

  /**
   * Nhận diện intent từ message
   * @param {string} message
   * @param {string} userId
   * @returns {string} intent
   */
  detectIntent(message, userId = null) {
    const lowerMsg = message.toLowerCase();

    // Kiểm tra từng intent pattern
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerMsg)) {
          return intent;
        }
      }
    }

    // Default: general question
    return "general";
  }

  /**
   * Nhận diện intent dựa trên context (session state)
   * @param {string} message
   * @param {Object} sessionContext
   * @returns {string|null} contextIntent hoặc null
   */
  detectContextIntent(message, sessionContext) {
    if (!sessionContext) return null;

    // Nếu đang có productOptions → user đang chọn sản phẩm
    if (
      sessionContext.productOptions &&
      sessionContext.productOptions.length > 0
    ) {
      if (
        /^\d+$/.test(message.trim()) ||
        /số|phiên bản|\d{7,}/i.test(message)
      ) {
        return "installment"; // Tiếp tục flow trả góp
      }
    }

    // Nếu đang có currentProduct và message không chứa tên sản phẩm mới
    if (sessionContext.currentProduct) {
      const hasNewProduct = this.productMentionPattern.test(message);

      // Các pattern cho việc tiếp tục flow trả góp
      const isInstallmentFollowUp =
        /\d+\s*tháng|thẻ tín dụng|công ty tài chính|tạo đơn|đổi|thay đổi|trả trước|đặt cọc|lãi suất|kỳ hạn/i.test(
          message
        );

      if (!hasNewProduct && isInstallmentFollowUp) {
        return "installment";
      }
    }

    return null;
  }

  /**
   * Kiểm tra xem message có chứa tên sản phẩm không
   * @param {string} message
   * @returns {boolean}
   */
  hasProductMention(message) {
    return this.productMentionPattern.test(message);
  }

  /**
   * Trích xuất tên sản phẩm từ message
   * @param {string} message
   * @returns {string|null}
   */
  extractProductName(message) {
    const match = message.match(this.productMentionPattern);
    return match ? match[0].trim() : null;
  }
}

module.exports = IntentService;
