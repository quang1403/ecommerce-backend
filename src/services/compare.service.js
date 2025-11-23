/**
 * Compare Service
 * So sánh chi tiết các sản phẩm
 */

const Product = require("../models/Product");
const logger = require("../utils/logger");

class CompareService {
  /**
   * So sánh 2 hoặc nhiều sản phẩm
   * @param {Array<string>} productIds
   * @returns {Promise<Object>}
   */
  async compareProducts(productIds) {
    try {
      if (!productIds || productIds.length < 2) {
        return {
          success: false,
          message: "Cần ít nhất 2 sản phẩm để so sánh",
        };
      }

      const products = await Product.find({
        _id: { $in: productIds },
      }).populate("brand");

      if (products.length < 2) {
        return {
          success: false,
          message: "Không tìm đủ sản phẩm để so sánh",
        };
      }

      const comparison = {
        products: products.map((p) => this.formatProductForComparison(p)),
        differences: this.findDifferences(products),
        similarities: this.findSimilarities(products),
        recommendation: this.generateRecommendation(products),
        summary: this.generateComparisonSummary(products),
      };

      logger.info("So sánh sản phẩm", {
        productIds,
        productCount: products.length,
      });

      return {
        success: true,
        data: comparison,
      };
    } catch (error) {
      logger.error("Lỗi khi so sánh sản phẩm", { error: error.message });
      return {
        success: false,
        message: "Lỗi khi so sánh sản phẩm",
      };
    }
  }

  /**
   * So sánh theo tiêu chí cụ thể
   * @param {Array<string>} productIds
   * @param {Array<string>} criteria - ['price', 'camera', 'battery', etc.]
   * @returns {Promise<Object>}
   */
  async compareBycriteria(productIds, criteria = []) {
    try {
      const products = await Product.find({
        _id: { $in: productIds },
      }).populate("brand");

      if (products.length < 2) {
        return {
          success: false,
          message: "Không tìm đủ sản phẩm để so sánh",
        };
      }

      const comparison = {};

      criteria.forEach((criterion) => {
        comparison[criterion] = this.compareByCriterion(products, criterion);
      });

      return {
        success: true,
        data: {
          products: products.map((p) => ({ id: p._id, name: p.name })),
          comparison,
        },
      };
    } catch (error) {
      logger.error("Lỗi khi so sánh theo tiêu chí", { error: error.message });
      return {
        success: false,
        message: "Lỗi khi so sánh",
      };
    }
  }

  /**
   * Format sản phẩm cho comparison
   * @param {Object} product
   * @returns {Object}
   */
  formatProductForComparison(product) {
    return {
      id: product._id,
      name: product.name,
      brand: product.brand?.name || "N/A",
      price: product.price,
      discount: product.discount || 0,
      finalPrice: product.price * (1 - (product.discount || 0) / 100),

      // Specs
      ram: product.ram,
      storage: product.storage,
      battery: product.battery,
      chipset: product.chipset || "N/A",
      displaySize: product.displaySize,
      displayType: product.displayType || "N/A",
      cameraRear: product.cameraRear || "N/A",
      cameraFront: product.cameraFront || "N/A",

      // Other
      rating: product.rating || 0,
      sold: product.sold || 0,
      stock: product.stock || 0,
      colors: product.colors || [],
    };
  }

  /**
   * Tìm điểm khác biệt
   * @param {Array} products
   * @returns {Object}
   */
  findDifferences(products) {
    const differences = {};

    const specs = [
      "price",
      "ram",
      "storage",
      "battery",
      "chipset",
      "displaySize",
      "cameraRear",
    ];

    specs.forEach((spec) => {
      const values = products.map((p) => p[spec]);
      const unique = [...new Set(values)];

      if (unique.length > 1) {
        differences[spec] = {
          values: products.map((p) => ({
            productName: p.name,
            value: p[spec],
          })),
          range: this.getRange(values),
          best: this.getBest(products, spec),
        };
      }
    });

    return differences;
  }

  /**
   * Tìm điểm tương đồng
   * @param {Array} products
   * @returns {Object}
   */
  findSimilarities(products) {
    const similarities = {};

    const specs = ["brand", "ram", "storage", "displaySize"];

    specs.forEach((spec) => {
      const values = products.map((p) => p[spec] || p.brand?.name);
      const unique = [...new Set(values)];

      if (unique.length === 1) {
        similarities[spec] = unique[0];
      }
    });

    return similarities;
  }

  /**
   * So sánh theo một tiêu chí
   * @param {Array} products
   * @param {string} criterion
   * @returns {Object}
   */
  compareByCriterion(products, criterion) {
    const values = products.map((p) => ({
      productId: p._id,
      productName: p.name,
      value: p[criterion],
    }));

    const sorted = [...values].sort((a, b) => {
      if (typeof a.value === "number" && typeof b.value === "number") {
        return b.value - a.value; // Descending
      }
      return 0;
    });

    return {
      values,
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      difference:
        typeof sorted[0]?.value === "number"
          ? sorted[0].value - sorted[sorted.length - 1].value
          : null,
    };
  }

  /**
   * Lấy range của values
   * @param {Array} values
   * @returns {Object|null}
   */
  getRange(values) {
    const numbers = values.filter((v) => typeof v === "number");
    if (numbers.length === 0) return null;

    return {
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      diff: Math.max(...numbers) - Math.min(...numbers),
    };
  }

  /**
   * Tìm sản phẩm tốt nhất theo spec
   * @param {Array} products
   * @param {string} spec
   * @returns {Object}
   */
  getBest(products, spec) {
    const sorted = products.sort((a, b) => {
      const aVal = a[spec];
      const bVal = b[spec];

      if (typeof aVal === "number" && typeof bVal === "number") {
        // Special case: price - lower is better
        if (spec === "price") {
          return aVal - bVal;
        }
        return bVal - aVal;
      }

      return 0;
    });

    return {
      productName: sorted[0].name,
      value: sorted[0][spec],
    };
  }

  /**
   * Tạo recommendation dựa trên comparison
   * @param {Array} products
   * @returns {Object}
   */
  generateRecommendation(products) {
    // Score products
    const scored = products
      .map((product) => {
        let score = 0;

        // Price-to-performance ratio
        const performanceScore =
          (product.ram || 0) * 10 +
          (product.storage || 0) / 10 +
          (product.battery || 0) / 100;
        const priceScore = product.price / 1000000; // Giá tính bằng triệu
        const valueScore = performanceScore / priceScore;

        score += valueScore * 20;

        // Rating
        score += (product.rating || 0) * 10;

        // Popularity
        score += Math.min((product.sold || 0) / 100, 20);

        // Stock
        if (product.stock > 0) score += 10;

        return {
          product: product.name,
          productId: product._id,
          score: Math.round(score),
          strengths: this.getProductStrengths(product, products),
          weaknesses: this.getProductWeaknesses(product, products),
        };
      })
      .sort((a, b) => b.score - a.score);

    return {
      recommended: scored[0],
      alternatives: scored.slice(1),
    };
  }

  /**
   * Tìm điểm mạnh của sản phẩm
   * @param {Object} product
   * @param {Array} allProducts
   * @returns {Array<string>}
   */
  getProductStrengths(product, allProducts) {
    const strengths = [];

    // Check if best in each category
    const specs = ["ram", "storage", "battery", "rating"];

    specs.forEach((spec) => {
      const values = allProducts.map((p) => p[spec] || 0);
      const max = Math.max(...values);

      if (product[spec] === max && max > 0) {
        strengths.push(this.getSpecLabel(spec) + " cao nhất");
      }
    });

    // Check if cheapest
    const prices = allProducts.map((p) => p.price);
    if (product.price === Math.min(...prices)) {
      strengths.push("Giá rẻ nhất");
    }

    // Check if best value
    if (product.sold > 500) {
      strengths.push("Bán chạy");
    }

    return strengths;
  }

  /**
   * Tìm điểm yếu của sản phẩm
   * @param {Object} product
   * @param {Array} allProducts
   * @returns {Array<string>}
   */
  getProductWeaknesses(product, allProducts) {
    const weaknesses = [];

    const specs = ["ram", "storage", "battery"];

    specs.forEach((spec) => {
      const values = allProducts.map((p) => p[spec] || 0);
      const min = Math.min(...values.filter((v) => v > 0));

      if (product[spec] === min && min > 0) {
        weaknesses.push(this.getSpecLabel(spec) + " thấp nhất");
      }
    });

    // Check if most expensive
    const prices = allProducts.map((p) => p.price);
    if (product.price === Math.max(...prices)) {
      weaknesses.push("Giá cao nhất");
    }

    // Stock
    if (product.stock === 0) {
      weaknesses.push("Hết hàng");
    }

    return weaknesses;
  }

  /**
   * Tạo summary so sánh
   * @param {Array} products
   * @returns {string}
   */
  generateComparisonSummary(products) {
    const summary = [];

    // Price range
    const prices = products.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    summary.push(
      `💰 Khoảng giá: ${this.formatPrice(minPrice)} - ${this.formatPrice(
        maxPrice
      )}`
    );

    // RAM range
    const rams = products.map((p) => p.ram);
    summary.push(`📱 RAM: ${Math.min(...rams)}GB - ${Math.max(...rams)}GB`);

    // Battery range
    const batteries = products.map((p) => p.battery || 0).filter((b) => b > 0);
    if (batteries.length > 0) {
      summary.push(
        `🔋 Pin: ${Math.min(...batteries)}mAh - ${Math.max(...batteries)}mAh`
      );
    }

    return summary.join("\n");
  }

  /**
   * Format giá
   * @param {number} price
   * @returns {string}
   */
  formatPrice(price) {
    return (price / 1000000).toFixed(1) + " triệu";
  }

  /**
   * Lấy label cho spec
   * @param {string} spec
   * @returns {string}
   */
  getSpecLabel(spec) {
    const labels = {
      ram: "RAM",
      storage: "Bộ nhớ",
      battery: "Pin",
      rating: "Đánh giá",
      price: "Giá",
      camera: "Camera",
      display: "Màn hình",
    };

    return labels[spec] || spec;
  }
}

module.exports = CompareService;
