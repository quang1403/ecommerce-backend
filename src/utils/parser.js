/**
 * Message Parser Utility
 * Parse user messages for specific intents and parameters
 */

const TextCleaner = require("./textCleaner");

class MessageParser {
  constructor() {
    // Intent patterns
    this.intentPatterns = {
      greeting: [
        /^(xin chào|chào|hello|hi|hey)/i,
        /^(good morning|good afternoon|good evening)/i,
      ],

      product_inquiry: [
        /\b(iphone|ipad|samsung|galaxy|xiaomi|redmi|oppo|vivo|realme|nokia)\b/i,
        /\b(điện thoại|phone|smartphone|máy tính bảng|tablet)\b/i,
        /\b(tai nghe|headphone|airpods|earphone)\b/i,
      ],

      installment: [
        /\b(trả góp|installment|thẻ tín dụng|credit card)\b/i,
        /\b(công ty tài chính|finance|lãi suất|interest)\b/i,
        /\d+\s*tháng/i,
      ],

      price_inquiry: [
        /\b(giá|price|bao nhiêu|how much)\b/i,
        /\b(rẻ nhất|cheapest|giá thấp)\b/i,
      ],

      stock_check: [
        /\b(còn hàng|tồn kho|stock|có sẵn|available)\b/i,
        /\b(hết hàng|out of stock|sold out)\b/i,
      ],

      order_tracking: [
        /\b(đơn hàng|order|tra cứu|check order)\b/i,
        /\b(giao hàng|delivery|shipping|bảo hành|warranty)\b/i,
        /\b\d{6,}\b/, // Order ID pattern
      ],

      comparison: [
        /\b(so sánh|compare|khác nhau|difference)\b/i,
        /\b(vs|versus|hay|hoặc|or)\b/i,
      ],
    };

    // Product extraction patterns
    this.productPatterns = {
      iphone: /iphone\s*(\d+)(?:\s*(pro|plus|mini|max))?/gi,
      samsung: /samsung\s*galaxy\s*([a-z]\d+)/gi,
      xiaomi: /(?:xiaomi|redmi|poco)\s*(\w+(?:\s+\w+)*)/gi,
      oppo: /oppo\s*([a-z]?\d+[a-z]?)/gi,
      vivo: /vivo\s*([a-z]?\d+[a-z]?)/gi,
    };

    // Parameter extraction patterns
    this.parameterPatterns = {
      budget:
        /(?:budget|ngân sách|tiền).*?(\d+(?:\.\d+)?)\s*(triệu|tr|k|đ|vnd)/gi,
      ram: /(\d+)\s*gb?\s*ram/gi,
      storage: /(\d+)\s*(gb|tb)\s*(?:storage|bộ nhớ)/gi,
      color: /màu\s*(\w+)|color\s*(\w+)/gi,
      brand: /thương hiệu\s*(\w+)|brand\s*(\w+)/gi,
    };
  }

  /**
   * Parse user message and extract intent and parameters
   * @param {string} message
   * @returns {Object}
   */
  parseMessage(message) {
    const cleanedMessage = TextCleaner.cleanText(message);
    const normalizedMessage = TextCleaner.normalizeVietnamese(message);

    return {
      originalMessage: message,
      cleanedMessage,
      normalizedMessage,
      intent: this.detectIntent(normalizedMessage),
      products: this.extractProducts(normalizedMessage),
      parameters: this.extractParameters(normalizedMessage),
      keywords: TextCleaner.extractKeywords(cleanedMessage, 5),
      numbers: TextCleaner.extractNumbers(message),
      prices: TextCleaner.extractPrices(message),
    };
  }

  /**
   * Detect intent from message
   * @param {string} message
   * @returns {string}
   */
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();

    // Check each intent pattern
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerMessage)) {
          return intent;
        }
      }
    }

    return "general";
  }

  /**
   * Extract product information from message
   * @param {string} message
   * @returns {Array}
   */
  extractProducts(message) {
    const products = [];

    for (const [brand, pattern] of Object.entries(this.productPatterns)) {
      const matches = [...message.matchAll(pattern)];

      matches.forEach((match) => {
        products.push({
          brand: brand,
          model: match[1],
          variant: match[2] || null,
          fullMatch: match[0],
        });
      });
    }

    return products;
  }

  /**
   * Extract parameters from message
   * @param {string} message
   * @returns {Object}
   */
  extractParameters(message) {
    const parameters = {};

    // Extract budget
    const budgetMatch = message.match(this.parameterPatterns.budget);
    if (budgetMatch) {
      let budget = parseFloat(budgetMatch[1]);
      const unit = budgetMatch[2].toLowerCase();

      if (unit.includes("triệu") || unit.includes("tr")) {
        budget *= 1000000;
      } else if (unit.includes("k")) {
        budget *= 1000;
      }

      parameters.budget = budget;
    }

    // Extract RAM
    const ramMatch = message.match(this.parameterPatterns.ram);
    if (ramMatch) {
      parameters.ram = parseInt(ramMatch[1]);
    }

    // Extract storage
    const storageMatch = message.match(this.parameterPatterns.storage);
    if (storageMatch) {
      let storage = parseInt(storageMatch[1]);
      if (storageMatch[2].toLowerCase() === "tb") {
        storage *= 1024;
      }
      parameters.storage = storage;
    }

    // Extract color
    const colorMatch = message.match(this.parameterPatterns.color);
    if (colorMatch) {
      parameters.color = colorMatch[1] || colorMatch[2];
    }

    // Extract brand preference
    const brandMatch = message.match(this.parameterPatterns.brand);
    if (brandMatch) {
      parameters.preferredBrand = brandMatch[1] || brandMatch[2];
    }

    return parameters;
  }

  /**
   * Check if message is a product selection (number)
   * @param {string} message
   * @returns {Object}
   */
  parseProductSelection(message) {
    // Check for number selection (1, 2, 3, etc.)
    const numberMatch = message.match(/(?:số\s+)?(\d+)/i);
    if (numberMatch) {
      const number = parseInt(numberMatch[1]);
      if (number >= 1 && number <= 10) {
        // Reasonable range
        return {
          isSelection: true,
          selectionType: "number",
          value: number,
        };
      }
    }

    // Check for price-based selection
    const priceKeywords = ["rẻ nhất", "giá thấp nhất", "rẻ", "cheapest"];
    if (
      priceKeywords.some((keyword) => message.toLowerCase().includes(keyword))
    ) {
      return {
        isSelection: true,
        selectionType: "price",
        value: "lowest",
      };
    }

    // Check for quality-based selection
    const qualityKeywords = ["tốt nhất", "chất lượng cao", "best", "premium"];
    if (
      qualityKeywords.some((keyword) => message.toLowerCase().includes(keyword))
    ) {
      return {
        isSelection: true,
        selectionType: "quality",
        value: "highest",
      };
    }

    return {
      isSelection: false,
      selectionType: null,
      value: null,
    };
  }

  /**
   * Parse installment parameters
   * @param {string} message
   * @returns {Object}
   */
  parseInstallmentParameters(message) {
    const parameters = {};

    // Extract installment term
    const termMatch = message.match(/(\d+)\s*tháng/i);
    if (termMatch) {
      parameters.term = parseInt(termMatch[1]);
    }

    // Extract down payment
    const downPaymentMatch = message.match(
      /trả\s*trước\s*(\d+(?:\.\d+)?)\s*(triệu|tr|k|đ|vnd)/gi
    );
    if (downPaymentMatch) {
      let amount = parseFloat(downPaymentMatch[1]);
      const unit = downPaymentMatch[2].toLowerCase();

      if (unit.includes("triệu") || unit.includes("tr")) {
        amount *= 1000000;
      } else if (unit.includes("k")) {
        amount *= 1000;
      }

      parameters.downPayment = amount;
    }

    // Extract payment method preference
    if (/thẻ tín dụng|credit card/i.test(message)) {
      parameters.paymentMethod = "credit_card";
    } else if (/công ty tài chính|finance company/i.test(message)) {
      parameters.paymentMethod = "finance_company";
    }

    return parameters;
  }

  /**
   * Validate parsed message
   * @param {Object} parsedMessage
   * @returns {Object}
   */
  validateParsedMessage(parsedMessage) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Check message length
    if (parsedMessage.originalMessage.length > 1000) {
      validation.warnings.push("Message is very long");
    }

    // Check for security issues
    if (/<script|javascript:|on\w+=/i.test(parsedMessage.originalMessage)) {
      validation.isValid = false;
      validation.errors.push("Potentially unsafe content detected");
    }

    // Check for meaningful content
    if (parsedMessage.cleanedMessage.length < 3) {
      validation.warnings.push("Message is very short");
    }

    return validation;
  }
}

module.exports = MessageParser;
