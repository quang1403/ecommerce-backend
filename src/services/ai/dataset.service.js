/**
 * Dataset Service
 * Quản lý và lưu trữ dữ liệu training cho chatbot
 */

const fs = require("fs");
const path = require("path");
const logger = require("../../utils/logger");

class DatasetService {
  constructor() {
    this.datasetsPath = path.join(__dirname, "../../datasets");
    this.trainingPath = path.join(this.datasetsPath, "training");
    this.suggestionsPath = path.join(this.datasetsPath, "suggestions");
    this.mistakesPath = path.join(this.datasetsPath, "mistakes");

    this.ensureDirectories();
  }

  /**
   * Đảm bảo các thư mục tồn tại
   */
  ensureDirectories() {
    [
      this.datasetsPath,
      this.trainingPath,
      this.suggestionsPath,
      this.mistakesPath,
    ].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Lưu dữ liệu tương tác chat để training
   * @param {Object} interaction - Dữ liệu tương tác
   */
  async saveTrainingData(interaction) {
    try {
      const {
        sessionId,
        userMessage,
        detectedIntent,
        botResponse,
        wasHelpful = null,
        timestamp = new Date(),
      } = interaction;

      const trainingData = {
        sessionId,
        userMessage,
        detectedIntent,
        botResponse: botResponse.substring(0, 200), // Chỉ lưu 200 ký tự đầu
        wasHelpful,
        timestamp,
      };

      const filename = path.join(
        this.trainingPath,
        `training_${new Date().toISOString().split("T")[0]}.jsonl`
      );

      const line = JSON.stringify(trainingData) + "\n";
      fs.appendFileSync(filename, line);

      logger.debug("Đã lưu dữ liệu training", {
        sessionId,
        intent: detectedIntent,
      });
    } catch (error) {
      logger.error("Lỗi khi lưu training data", { error: error.message });
    }
  }

  /**
   * Lưu câu hỏi mà bot không trả lời được tốt
   * @param {Object} mistake - Thông tin lỗi
   */
  async saveMistake(mistake) {
    try {
      const {
        sessionId,
        userMessage,
        detectedIntent,
        botResponse,
        actualIntent = null,
        feedback = null,
        timestamp = new Date(),
      } = mistake;

      const mistakeData = {
        sessionId,
        userMessage,
        detectedIntent,
        actualIntent,
        botResponse: botResponse.substring(0, 200),
        feedback,
        timestamp,
      };

      const filename = path.join(
        this.mistakesPath,
        `mistakes_${new Date().toISOString().split("T")[0]}.jsonl`
      );

      const line = JSON.stringify(mistakeData) + "\n";
      fs.appendFileSync(filename, line);

      logger.info("Đã lưu lỗi để cải thiện", { sessionId, userMessage });
    } catch (error) {
      logger.error("Lỗi khi lưu mistake data", { error: error.message });
    }
  }

  /**
   * Lưu gợi ý sản phẩm thành công
   * @param {Object} suggestion - Thông tin gợi ý
   */
  async saveSuggestion(suggestion) {
    try {
      const {
        sessionId,
        userMessage,
        suggestedProducts,
        userSelected = null,
        timestamp = new Date(),
      } = suggestion;

      const suggestionData = {
        sessionId,
        userMessage,
        suggestedProducts: suggestedProducts.map((p) => ({
          id: p._id,
          name: p.name,
          price: p.price,
        })),
        userSelected,
        timestamp,
      };

      const filename = path.join(
        this.suggestionsPath,
        `suggestions_${new Date().toISOString().split("T")[0]}.jsonl`
      );

      const line = JSON.stringify(suggestionData) + "\n";
      fs.appendFileSync(filename, line);

      logger.debug("Đã lưu suggestion data", { sessionId });
    } catch (error) {
      logger.error("Lỗi khi lưu suggestion data", { error: error.message });
    }
  }

  /**
   * Đọc dữ liệu training theo khoảng thời gian
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Array} Danh sách training data
   */
  async getTrainingData(startDate, endDate) {
    try {
      const files = fs.readdirSync(this.trainingPath);
      const data = [];

      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;

        const filePath = path.join(this.trainingPath, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n").filter((line) => line.trim());

        lines.forEach((line) => {
          try {
            const item = JSON.parse(line);
            const itemDate = new Date(item.timestamp);

            if (itemDate >= startDate && itemDate <= endDate) {
              data.push(item);
            }
          } catch (e) {
            // Bỏ qua dòng lỗi
          }
        });
      }

      return data;
    } catch (error) {
      logger.error("Lỗi khi đọc training data", { error: error.message });
      return [];
    }
  }

  /**
   * Phân tích dữ liệu training để cải thiện intent detection
   * @returns {Object} Thống kê và insights
   */
  async analyzeTrainingData() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const data = await this.getTrainingData(thirtyDaysAgo, new Date());

      const stats = {
        totalInteractions: data.length,
        intentDistribution: {},
        helpfulnessRate: 0,
        commonQueries: {},
        avgResponseLength: 0,
      };

      let helpfulCount = 0;
      let totalResponseLength = 0;

      data.forEach((item) => {
        // Intent distribution
        stats.intentDistribution[item.detectedIntent] =
          (stats.intentDistribution[item.detectedIntent] || 0) + 1;

        // Helpfulness
        if (item.wasHelpful === true) helpfulCount++;

        // Common queries
        const normalized = item.userMessage.toLowerCase();
        stats.commonQueries[normalized] =
          (stats.commonQueries[normalized] || 0) + 1;

        // Response length
        totalResponseLength += item.botResponse.length;
      });

      stats.helpfulnessRate =
        data.length > 0 ? ((helpfulCount / data.length) * 100).toFixed(2) : 0;

      stats.avgResponseLength =
        data.length > 0 ? Math.round(totalResponseLength / data.length) : 0;

      // Lấy top 10 câu hỏi phổ biến
      stats.topQueries = Object.entries(stats.commonQueries)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([query, count]) => ({ query, count }));

      delete stats.commonQueries; // Xóa để không quá dài

      logger.info("Đã phân tích training data", stats);
      return stats;
    } catch (error) {
      logger.error("Lỗi khi phân tích training data", { error: error.message });
      return null;
    }
  }

  /**
   * Xuất dữ liệu training ra file JSON để fine-tune
   * @param {string} outputPath
   */
  async exportForFineTuning(outputPath) {
    try {
      const data = await this.getTrainingData(
        new Date(2024, 0, 1), // Từ đầu 2024
        new Date()
      );

      // Format dữ liệu cho fine-tuning OpenAI
      const formattedData = data.map((item) => ({
        messages: [
          {
            role: "system",
            content: "Bạn là trợ lý tư vấn bán hàng điện thoại chuyên nghiệp.",
          },
          {
            role: "user",
            content: item.userMessage,
          },
          {
            role: "assistant",
            content: item.botResponse,
          },
        ],
      }));

      fs.writeFileSync(
        outputPath,
        JSON.stringify(formattedData, null, 2),
        "utf-8"
      );

      logger.info("Đã xuất dữ liệu fine-tuning", {
        count: formattedData.length,
        outputPath,
      });

      return formattedData.length;
    } catch (error) {
      logger.error("Lỗi khi xuất fine-tuning data", { error: error.message });
      return 0;
    }
  }

  /**
   * Dọn dẹp dữ liệu cũ (> 90 ngày)
   */
  async cleanOldData() {
    try {
      const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 ngày
      const now = Date.now();
      let deletedCount = 0;

      [this.trainingPath, this.suggestionsPath, this.mistakesPath].forEach(
        (dir) => {
          const files = fs.readdirSync(dir);

          files.forEach((file) => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);

            if (now - stats.mtimeMs > maxAge) {
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          });
        }
      );

      logger.info("Đã dọn dẹp dữ liệu cũ", { deletedFiles: deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error("Lỗi khi dọn dẹp dữ liệu", { error: error.message });
      return 0;
    }
  }
}

module.exports = DatasetService;
