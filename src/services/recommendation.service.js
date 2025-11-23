/**
 * Recommendation Service
 * Gợi ý sản phẩm thông minh dựa trên nhiều yếu tố
 */

const Product = require("../models/Product");
const logger = require("../utils/logger");

class RecommendationService {
  /**
   * Gợi ý sản phẩm dựa trên ngân sách
   * @param {number} budget - Ngân sách
   * @param {Object} preferences - Sở thích (brand, features, etc.)
   * @returns {Promise<Array>}
   */
  async recommendByBudget(budget, preferences = {}) {
    try {
      const query = {
        price: { $lte: budget },
        stock: { $gt: 0 },
      };

      // Thêm filter theo preferences
      if (preferences.brand) {
        query["brand.name"] = new RegExp(preferences.brand, "i");
      }

      if (preferences.minRam) {
        query.ram = { $gte: preferences.minRam };
      }

      if (preferences.minStorage) {
        query.storage = { $gte: preferences.minStorage };
      }

      const products = await Product.find(query)
        .populate("brand")
        .sort({ rating: -1, sold: -1 })
        .limit(10);

      // Score products
      const scoredProducts = this.scoreProducts(products, {
        budget,
        ...preferences,
      });

      logger.info("Gợi ý theo ngân sách", {
        budget,
        preferences,
        resultCount: scoredProducts.length,
      });

      return scoredProducts.slice(0, 5);
    } catch (error) {
      logger.error("Lỗi khi gợi ý theo ngân sách", { error: error.message });
      return [];
    }
  }

  /**
   * Gợi ý sản phẩm tương tự
   * @param {string} productId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async recommendSimilar(productId, limit = 5) {
    try {
      const product = await Product.findById(productId).populate("brand");

      if (!product) {
        return [];
      }

      // Tìm sản phẩm cùng thương hiệu, giá tương đương
      const priceRange = product.price * 0.3; // ±30%

      const similar = await Product.find({
        _id: { $ne: productId },
        "brand.name": product.brand.name,
        price: {
          $gte: product.price - priceRange,
          $lte: product.price + priceRange,
        },
        stock: { $gt: 0 },
      })
        .populate("brand")
        .sort({ rating: -1 })
        .limit(limit);

      logger.info("Gợi ý sản phẩm tương tự", {
        productId,
        productName: product.name,
        resultCount: similar.length,
      });

      return similar;
    } catch (error) {
      logger.error("Lỗi khi gợi ý sản phẩm tương tự", { error: error.message });
      return [];
    }
  }

  /**
   * Gợi ý sản phẩm theo use case
   * @param {string} useCase - gaming, photography, business, student, etc.
   * @param {number} budget
   * @returns {Promise<Array>}
   */
  async recommendByUseCase(useCase, budget = null) {
    try {
      const useCaseConfigs = {
        gaming: {
          minRam: 8,
          minStorage: 128,
          keywords: ["gaming", "game", "snapdragon", "dimensity"],
          sortBy: { ram: -1, chipset: -1 },
        },
        photography: {
          keywords: ["camera", "48mp", "64mp", "108mp", "ai camera"],
          sortBy: { cameraRear: -1 },
        },
        business: {
          minRam: 6,
          minStorage: 128,
          keywords: ["pro", "premium", "flagship"],
          sortBy: { price: -1, rating: -1 },
        },
        student: {
          maxPrice: 10000000, // 10 triệu
          keywords: ["budget", "giá rẻ", "affordable"],
          sortBy: { price: 1, rating: -1 },
        },
        battery: {
          minBattery: 5000,
          keywords: ["pin", "battery", "mah"],
          sortBy: { battery: -1 },
        },
      };

      const config = useCaseConfigs[useCase.toLowerCase()] || {};

      const query = { stock: { $gt: 0 } };

      if (budget) {
        query.price = { $lte: budget };
      } else if (config.maxPrice) {
        query.price = { $lte: config.maxPrice };
      }

      if (config.minRam) {
        query.ram = { $gte: config.minRam };
      }

      if (config.minStorage) {
        query.storage = { $gte: config.minStorage };
      }

      if (config.minBattery) {
        query.battery = { $gte: config.minBattery };
      }

      const products = await Product.find(query)
        .populate("brand")
        .sort(config.sortBy || { rating: -1 })
        .limit(10);

      logger.info("Gợi ý theo use case", {
        useCase,
        budget,
        resultCount: products.length,
      });

      return products.slice(0, 5);
    } catch (error) {
      logger.error("Lỗi khi gợi ý theo use case", { error: error.message });
      return [];
    }
  }

  /**
   * Gợi ý sản phẩm phổ biến
   * @param {Object} filters
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async recommendPopular(filters = {}, limit = 10) {
    try {
      const query = { stock: { $gt: 0 } };

      if (filters.brand) {
        query["brand.name"] = new RegExp(filters.brand, "i");
      }

      if (filters.priceRange) {
        query.price = {
          $gte: filters.priceRange.min || 0,
          $lte: filters.priceRange.max || Number.MAX_SAFE_INTEGER,
        };
      }

      const products = await Product.find(query)
        .populate("brand")
        .sort({ sold: -1, rating: -1 })
        .limit(limit);

      logger.info("Gợi ý sản phẩm phổ biến", {
        filters,
        resultCount: products.length,
      });

      return products;
    } catch (error) {
      logger.error("Lỗi khi gợi ý sản phẩm phổ biến", { error: error.message });
      return [];
    }
  }

  /**
   * Gợi ý sản phẩm mới nhất
   * @param {Object} filters
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async recommendNew(filters = {}, limit = 10) {
    try {
      const query = { stock: { $gt: 0 } };

      if (filters.brand) {
        query["brand.name"] = new RegExp(filters.brand, "i");
      }

      const products = await Product.find(query)
        .populate("brand")
        .sort({ createdAt: -1 })
        .limit(limit);

      logger.info("Gợi ý sản phẩm mới", {
        filters,
        resultCount: products.length,
      });

      return products;
    } catch (error) {
      logger.error("Lỗi khi gợi ý sản phẩm mới", { error: error.message });
      return [];
    }
  }

  /**
   * Gợi ý dựa trên lịch sử mua hàng
   * @param {string} userId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async recommendBasedOnHistory(userId, limit = 5) {
    try {
      // Lấy lịch sử đơn hàng của user
      const Order = require("../models/Order");
      const orders = await Order.find({ user: userId })
        .populate("items.product")
        .sort({ createdAt: -1 })
        .limit(10);

      if (orders.length === 0) {
        // Nếu chưa có lịch sử, trả về sản phẩm phổ biến
        return this.recommendPopular({}, limit);
      }

      // Lấy thương hiệu user đã mua
      const purchasedBrands = new Set();
      const avgPrice = [];

      orders.forEach((order) => {
        order.items.forEach((item) => {
          if (item.product) {
            purchasedBrands.add(item.product.brand?.name);
            avgPrice.push(item.product.price);
          }
        });
      });

      const userAvgPrice =
        avgPrice.reduce((a, b) => a + b, 0) / avgPrice.length;

      // Gợi ý sản phẩm cùng thương hiệu, giá tương đương
      const brands = Array.from(purchasedBrands);
      const priceRange = userAvgPrice * 0.3;

      const products = await Product.find({
        "brand.name": { $in: brands },
        price: {
          $gte: userAvgPrice - priceRange,
          $lte: userAvgPrice + priceRange,
        },
        stock: { $gt: 0 },
      })
        .populate("brand")
        .sort({ rating: -1, createdAt: -1 })
        .limit(limit);

      logger.info("Gợi ý dựa trên lịch sử", {
        userId,
        purchasedBrands: brands,
        avgPrice: userAvgPrice,
        resultCount: products.length,
      });

      return products;
    } catch (error) {
      logger.error("Lỗi khi gợi ý dựa trên lịch sử", { error: error.message });
      return [];
    }
  }

  /**
   * Score sản phẩm dựa trên nhiều yếu tố
   * @param {Array} products
   * @param {Object} criteria
   * @returns {Array}
   */
  scoreProducts(products, criteria = {}) {
    return products
      .map((product) => {
        let score = 0;

        // Rating (max 50 points)
        score += (product.rating || 0) * 10;

        // Sold count (max 30 points)
        score += Math.min((product.sold || 0) / 100, 30);

        // Budget match (max 20 points)
        if (criteria.budget) {
          const priceDiff = Math.abs(product.price - criteria.budget);
          const maxDiff = criteria.budget;
          score += Math.max(0, 20 * (1 - priceDiff / maxDiff));
        }

        // Brand preference (bonus 10 points)
        if (
          criteria.brand &&
          product.brand?.name
            .toLowerCase()
            .includes(criteria.brand.toLowerCase())
        ) {
          score += 10;
        }

        // Stock bonus (5 points)
        if (product.stock > 0) {
          score += 5;
        }

        return {
          ...product.toObject(),
          recommendationScore: Math.round(score),
        };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  /**
   * Tạo câu giải thích recommendation
   * @param {Object} product
   * @param {string} reason
   * @returns {string}
   */
  generateRecommendationReason(product, reason = "") {
    const reasons = [];

    if (product.rating >= 4.5) {
      reasons.push("⭐ Đánh giá cao " + product.rating + "/5");
    }

    if (product.sold > 1000) {
      reasons.push("🔥 Bán chạy với " + product.sold + " sản phẩm đã bán");
    }

    if (product.discount > 0) {
      reasons.push("💰 Đang giảm giá " + product.discount + "%");
    }

    if (product.stock > 0 && product.stock <= 10) {
      reasons.push("⚡ Chỉ còn " + product.stock + " sản phẩm");
    }

    if (reason) {
      reasons.unshift(reason);
    }

    return reasons.join(" • ");
  }
}

module.exports = RecommendationService;
