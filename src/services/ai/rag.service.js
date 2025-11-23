/**
 * RAG Service (Retrieval-Augmented Generation)
 * Tăng cường khả năng trả lời bằng cách truy xuất thông tin từ database
 */

const Embedding = require("../../models/Embedding");
const Product = require("../../models/Product");
const { createEmbeddings } = require("../../config/openai");
const logger = require("../../utils/logger");

class RAGService {
  /**
   * Tìm kiếm thông tin liên quan dựa trên câu hỏi
   * @param {string} query - Câu hỏi của user
   * @param {Object} options - Tùy chọn
   * @returns {Promise<Array>}
   */
  async retrieveRelevantContext(query, options = {}) {
    try {
      const { type = null, limit = 5, threshold = 0.7 } = options;

      // Tạo embedding cho query
      const queryEmbeddings = await createEmbeddings(query);
      const queryVector = queryEmbeddings[0];

      // Tìm embeddings tương đồng
      const results = await Embedding.findSimilar(queryVector, {
        type,
        limit,
        threshold,
      });

      // Update query count
      results.forEach((result) => {
        Embedding.findByIdAndUpdate(result._id, {
          $inc: { queryCount: 1 },
          lastQueriedAt: new Date(),
        }).exec();
      });

      logger.info("RAG retrieval", {
        query: query.substring(0, 50),
        resultCount: results.length,
        avgSimilarity:
          results.length > 0
            ? (
                results.reduce((sum, r) => sum + r.similarity, 0) /
                results.length
              ).toFixed(3)
            : 0,
      });

      return results;
    } catch (error) {
      logger.error("Lỗi khi retrieve context", { error: error.message });
      return [];
    }
  }

  /**
   * Tạo context string từ kết quả retrieval
   * @param {Array} results - Kết quả từ retrieveRelevantContext
   * @returns {string}
   */
  buildContextString(results) {
    if (!results || results.length === 0) {
      return "";
    }

    let context = "Thông tin liên quan:\n\n";

    results.forEach((result, index) => {
      context += `${index + 1}. ${result.text}\n`;
      if (result.metadata?.title) {
        context += `   (Nguồn: ${result.metadata.title})\n`;
      }
      context += `   (Độ liên quan: ${(result.similarity * 100).toFixed(
        1
      )}%)\n\n`;
    });

    return context;
  }

  /**
   * Embed sản phẩm để search
   * @param {string} productId
   * @returns {Promise<Object>}
   */
  async embedProduct(productId) {
    try {
      const product = await Product.findById(productId).populate("brand");

      if (!product) {
        return { success: false, message: "Không tìm thấy sản phẩm" };
      }

      // Tạo text mô tả sản phẩm
      const text = this.createProductDescription(product);

      // Tạo embedding
      const embeddings = await createEmbeddings(text);
      const embedding = embeddings[0];

      // Lưu vào database
      await Embedding.upsertEmbedding({
        type: "product",
        referenceId: product._id,
        referenceModel: "Product",
        text,
        embedding,
        metadata: {
          title: product.name,
          brand: product.brand?.name,
          category: product.category,
          price: product.price,
        },
        embeddingModel: "text-embedding-3-small",
        dimensions: 1536,
      });

      logger.info("Đã embed sản phẩm", {
        productId,
        productName: product.name,
      });

      return {
        success: true,
        message: "Đã tạo embedding cho sản phẩm",
        productId,
      };
    } catch (error) {
      logger.error("Lỗi khi embed sản phẩm", {
        error: error.message,
        productId,
      });
      return {
        success: false,
        message: "Lỗi khi tạo embedding",
      };
    }
  }

  /**
   * Embed tất cả sản phẩm
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async embedAllProducts(options = {}) {
    try {
      const { batchSize = 10 } = options;

      const products = await Product.find({ stock: { $gt: 0 } })
        .populate("brand")
        .lean();

      let successCount = 0;
      let errorCount = 0;

      // Process in batches
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map((product) => this.embedProduct(product._id))
        );

        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value.success) {
            successCount++;
          } else {
            errorCount++;
          }
        });

        // Delay để tránh rate limit
        if (i + batchSize < products.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      logger.info("Hoàn thành embed tất cả sản phẩm", {
        total: products.length,
        success: successCount,
        error: errorCount,
      });

      return {
        success: true,
        message: "Đã embed tất cả sản phẩm",
        stats: {
          total: products.length,
          success: successCount,
          error: errorCount,
        },
      };
    } catch (error) {
      logger.error("Lỗi khi embed tất cả sản phẩm", { error: error.message });
      return {
        success: false,
        message: "Lỗi khi embed sản phẩm",
      };
    }
  }

  /**
   * Tạo mô tả sản phẩm cho embedding
   * @param {Object} product
   * @returns {string}
   */
  createProductDescription(product) {
    const parts = [];

    // Tên và thương hiệu
    parts.push(`Sản phẩm: ${product.name}`);
    if (product.brand?.name) {
      parts.push(`Thương hiệu: ${product.brand.name}`);
    }

    // Giá
    parts.push(`Giá: ${product.price.toLocaleString("vi-VN")}đ`);

    // Specs
    if (product.ram) {
      parts.push(`RAM: ${product.ram}GB`);
    }
    if (product.storage) {
      parts.push(`Bộ nhớ: ${product.storage}GB`);
    }
    if (product.battery) {
      parts.push(`Pin: ${product.battery}mAh`);
    }
    if (product.chipset) {
      parts.push(`Chip: ${product.chipset}`);
    }
    if (product.displaySize) {
      parts.push(
        `Màn hình: ${product.displaySize}" ${product.displayType || ""}`
      );
    }
    if (product.cameraRear) {
      parts.push(`Camera sau: ${product.cameraRear}`);
    }

    // Mô tả
    if (product.description) {
      parts.push(`Mô tả: ${product.description}`);
    }

    // Rating và sold
    if (product.rating) {
      parts.push(`Đánh giá: ${product.rating}/5 sao`);
    }
    if (product.sold) {
      parts.push(`Đã bán: ${product.sold} sản phẩm`);
    }

    return parts.join(". ");
  }

  /**
   * Tìm sản phẩm bằng semantic search
   * @param {string} query
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async semanticProductSearch(query, options = {}) {
    try {
      const { limit = 10, threshold = 0.6 } = options;

      // Retrieve relevant embeddings
      const results = await this.retrieveRelevantContext(query, {
        type: "product",
        limit: limit * 2, // Get more to filter
        threshold,
      });

      if (results.length === 0) {
        return [];
      }

      // Get product IDs
      const productIds = results.map((r) => r.referenceId);

      // Fetch full products
      const products = await Product.find({ _id: { $in: productIds } })
        .populate("brand")
        .lean();

      // Sort by similarity
      const sortedProducts = products
        .map((product) => {
          const embedding = results.find(
            (r) => r.referenceId.toString() === product._id.toString()
          );
          return {
            ...product,
            similarity: embedding?.similarity || 0,
          };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      logger.info("Semantic product search", {
        query: query.substring(0, 50),
        resultCount: sortedProducts.length,
      });

      return sortedProducts;
    } catch (error) {
      logger.error("Lỗi khi semantic search", { error: error.message });
      return [];
    }
  }

  /**
   * Xóa embeddings cũ
   * @param {number} daysOld
   * @returns {Promise<number>}
   */
  async cleanOldEmbeddings(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Embedding.deleteMany({
        updatedAt: { $lt: cutoffDate },
        queryCount: 0, // Chưa được query lần nào
      });

      logger.info("Đã xóa embeddings cũ", {
        deletedCount: result.deletedCount,
        daysOld,
      });

      return result.deletedCount;
    } catch (error) {
      logger.error("Lỗi khi xóa embeddings cũ", { error: error.message });
      return 0;
    }
  }

  /**
   * Lấy thống kê embeddings
   * @returns {Promise<Object>}
   */
  async getEmbeddingStats() {
    try {
      const stats = await Embedding.getStats();

      const total = await Embedding.countDocuments();
      const active = await Embedding.countDocuments({ isActive: true });

      return {
        total,
        active,
        byType: stats,
      };
    } catch (error) {
      logger.error("Lỗi khi lấy stats", { error: error.message });
      return null;
    }
  }

  /**
   * Tìm câu trả lời từ Q&A dataset
   * @param {string} query - Câu hỏi
   * @returns {Promise<Object|null>}
   */
  async findQAAnswer(query) {
    try {
      const fs = require("fs");
      const path = require("path");
      const qaFilePath = path.join(
        __dirname,
        "../../datasets/dataset_qa.jsonl"
      );

      if (!fs.existsSync(qaFilePath)) {
        logger.warn("Dataset Q&A không tồn tại");
        return null;
      }

      const content = fs.readFileSync(qaFilePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());

      const normalizedQuery = this.normalizeText(query);
      let bestMatch = null;
      let bestScore = 0;

      for (const line of lines) {
        try {
          const qa = JSON.parse(line);
          const normalizedQuestion = this.normalizeText(qa.question);

          // Tính similarity score
          const score = this.calculateSimilarity(
            normalizedQuery,
            normalizedQuestion
          );

          if (score > bestScore && score > 0.6) {
            // threshold 60%
            bestScore = score;
            bestMatch = qa;
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }

      if (bestMatch) {
        logger.info("Tìm thấy câu trả lời trong Q&A dataset", {
          question: bestMatch.question,
          score: bestScore.toFixed(2),
        });
        return {
          answer: bestMatch.answer,
          category: bestMatch.category,
          confidence: bestScore,
          source: "qa_dataset",
        };
      }

      return null;
    } catch (error) {
      logger.error("Lỗi khi tìm Q&A", { error: error.message });
      return null;
    }
  }

  /**
   * Normalize text for comparison
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^\w\s]/g, " ") // Remove special chars
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  }

  /**
   * Calculate similarity between two texts
   */
  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(" "));
    const words2 = new Set(text2.split(" "));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size; // Jaccard similarity
  }
}

module.exports = RAGService;
