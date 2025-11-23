/**
 * Text Cleaner Utility
 * Chuẩn hóa và làm sạch text input
 */

class TextCleaner {
  /**
   * Normalize Vietnamese text
   * @param {string} text
   * @returns {string}
   */
  static normalizeVietnamese(text) {
    if (!text) return "";

    return text
      .toLowerCase()
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
      .replace(/[èéẹẻẽêềếệểễ]/g, "e")
      .replace(/[ìíịỉĩ]/g, "i")
      .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
      .replace(/[ùúụủũưừứựửữ]/g, "u")
      .replace(/[ỳýỵỷỹ]/g, "y")
      .replace(/đ/g, "d")
      .trim();
  }

  /**
   * Remove special characters and normalize spaces
   * @param {string} text
   * @returns {string}
   */
  static cleanText(text) {
    if (!text) return "";

    return text
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract numbers from text
   * @param {string} text
   * @returns {Array<number>}
   */
  static extractNumbers(text) {
    if (!text) return [];

    const matches = text.match(/\d+/g);
    return matches ? matches.map(Number) : [];
  }

  /**
   * Extract price values from text
   * @param {string} text
   * @returns {Array<number>}
   */
  static extractPrices(text) {
    if (!text) return [];

    const pricePatterns = [
      /(\d+(?:\.\d+)?)\s*(triệu|tr|million)/gi,
      /(\d+(?:\.\d+)?)\s*k/gi,
      /(\d+(?:,\d{3})*)\s*đ/gi,
      /(\d+(?:,\d{3})*)\s*vnd/gi,
    ];

    const prices = [];

    pricePatterns.forEach((pattern) => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        let value = parseFloat(match[1].replace(/,/g, ""));

        if (
          match[2] &&
          (match[2].toLowerCase().includes("triệu") ||
            match[2].toLowerCase().includes("tr"))
        ) {
          value *= 1000000;
        } else if (match[2] && match[2].toLowerCase().includes("k")) {
          value *= 1000;
        }

        prices.push(value);
      }
    });

    return prices;
  }

  /**
   * Remove stop words (Vietnamese)
   * @param {string} text
   * @returns {string}
   */
  static removeStopWords(text) {
    if (!text) return "";

    const stopWords = [
      "tôi",
      "tui",
      "mình",
      "em",
      "anh",
      "chị",
      "bạn",
      "của",
      "cho",
      "với",
      "từ",
      "trong",
      "ngoài",
      "trên",
      "dưới",
      "và",
      "hoặc",
      "nhưng",
      "mà",
      "nếu",
      "thì",
      "một",
      "hai",
      "ba",
      "bốn",
      "năm",
      "sáu",
      "bảy",
      "tám",
      "chín",
      "mười",
      "cái",
      "chiếc",
      "con",
      "quả",
      "cây",
      "rất",
      "khá",
      "hơi",
      "quá",
      "too",
      "very",
    ];

    const words = text.split(" ");
    const filteredWords = words.filter(
      (word) => !stopWords.includes(word.toLowerCase()) && word.length > 1
    );

    return filteredWords.join(" ");
  }

  /**
   * Extract keywords from text
   * @param {string} text
   * @param {number} maxKeywords
   * @returns {Array<string>}
   */
  static extractKeywords(text, maxKeywords = 10) {
    if (!text) return [];

    // Clean and normalize text
    let cleanedText = this.normalizeVietnamese(text);
    cleanedText = this.cleanText(cleanedText);
    cleanedText = this.removeStopWords(cleanedText);

    // Split into words and count frequency
    const words = cleanedText.split(" ").filter((word) => word.length > 2);
    const wordCount = {};

    words.forEach((word) => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Sort by frequency and return top keywords
    const sortedWords = Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxKeywords)
      .map(([word]) => word);

    return sortedWords;
  }

  /**
   * Check if text contains product mention
   * @param {string} text
   * @returns {boolean}
   */
  static hasProductMention(text) {
    if (!text) return false;

    const productKeywords = [
      "iphone",
      "ipad",
      "samsung",
      "galaxy",
      "xiaomi",
      "redmi",
      "poco",
      "oppo",
      "find",
      "reno",
      "vivo",
      "realme",
      "nokia",
      "airpods",
      "điện thoại",
      "phone",
      "smartphone",
      "máy tính bảng",
      "tablet",
      "tai nghe",
      "headphone",
      "earphone",
    ];

    const normalizedText = this.normalizeVietnamese(text);

    return productKeywords.some((keyword) => normalizedText.includes(keyword));
  }

  /**
   * Sanitize user input for security
   * @param {string} input
   * @returns {string}
   */
  static sanitizeInput(input) {
    if (!input) return "";

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .trim()
      .substring(0, 1000); // Limit length
  }
}

module.exports = TextCleaner;
