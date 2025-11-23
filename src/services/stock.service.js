/**
 * Stock Service
 * Quản lý và kiểm tra tồn kho sản phẩm
 */

const Product = require("../models/Product");
const logger = require("../utils/logger");

class StockService {
  /**
   * Kiểm tra tồn kho của một sản phẩm
   * @param {string} productId
   * @returns {Promise<Object>}
   */
  async checkStock(productId) {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        return {
          success: false,
          message: "Không tìm thấy sản phẩm",
        };
      }

      const stockInfo = {
        productId: product._id,
        productName: product.name,
        stock: product.stock,
        status: this.getStockStatus(product.stock),
        available: product.stock > 0,
        estimatedRestockDate: product.estimatedRestockDate || null,
      };

      logger.info("Kiểm tra tồn kho", { productId, stock: product.stock });

      return {
        success: true,
        data: stockInfo,
      };
    } catch (error) {
      logger.error("Lỗi khi kiểm tra tồn kho", {
        error: error.message,
        productId,
      });
      return {
        success: false,
        message: "Lỗi khi kiểm tra tồn kho",
      };
    }
  }

  /**
   * Kiểm tra tồn kho nhiều sản phẩm
   * @param {Array<string>} productIds
   * @returns {Promise<Object>}
   */
  async checkMultipleStock(productIds) {
    try {
      const products = await Product.find({ _id: { $in: productIds } });

      const stockData = products.map((product) => ({
        productId: product._id,
        productName: product.name,
        stock: product.stock,
        status: this.getStockStatus(product.stock),
        available: product.stock > 0,
      }));

      return {
        success: true,
        data: stockData,
      };
    } catch (error) {
      logger.error("Lỗi khi kiểm tra tồn kho nhiều sản phẩm", {
        error: error.message,
      });
      return {
        success: false,
        message: "Lỗi khi kiểm tra tồn kho",
      };
    }
  }

  /**
   * Lấy sản phẩm còn hàng theo query
   * @param {Object} query - MongoDB query
   * @param {Object} options - Options
   * @returns {Promise<Array>}
   */
  async getInStockProducts(query = {}, options = {}) {
    try {
      const { limit = 20, sort = { createdAt: -1 } } = options;

      const products = await Product.find({
        ...query,
        stock: { $gt: 0 },
      })
        .populate("brand")
        .sort(sort)
        .limit(limit);

      return products;
    } catch (error) {
      logger.error("Lỗi khi lấy sản phẩm còn hàng", { error: error.message });
      return [];
    }
  }

  /**
   * Lấy sản phẩm hết hàng
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async getOutOfStockProducts(options = {}) {
    try {
      const { limit = 20, sort = { createdAt: -1 } } = options;

      const products = await Product.find({ stock: { $lte: 0 } })
        .populate("brand")
        .sort(sort)
        .limit(limit);

      return products;
    } catch (error) {
      logger.error("Lỗi khi lấy sản phẩm hết hàng", { error: error.message });
      return [];
    }
  }

  /**
   * Lấy sản phẩm sắp hết hàng (stock <= threshold)
   * @param {number} threshold
   * @returns {Promise<Array>}
   */
  async getLowStockProducts(threshold = 10) {
    try {
      const products = await Product.find({
        stock: { $gt: 0, $lte: threshold },
      })
        .populate("brand")
        .sort({ stock: 1 });

      logger.info("Sản phẩm sắp hết hàng", {
        count: products.length,
        threshold,
      });

      return products;
    } catch (error) {
      logger.error("Lỗi khi lấy sản phẩm sắp hết hàng", {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Cập nhật tồn kho
   * @param {string} productId
   * @param {number} quantity - Số lượng thay đổi (+ hoặc -)
   * @returns {Promise<Object>}
   */
  async updateStock(productId, quantity) {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        return {
          success: false,
          message: "Không tìm thấy sản phẩm",
        };
      }

      const newStock = product.stock + quantity;

      if (newStock < 0) {
        return {
          success: false,
          message: "Tồn kho không đủ",
          currentStock: product.stock,
        };
      }

      product.stock = newStock;
      await product.save();

      logger.info("Cập nhật tồn kho", {
        productId,
        oldStock: product.stock - quantity,
        newStock: product.stock,
      });

      return {
        success: true,
        message: "Cập nhật tồn kho thành công",
        data: {
          productId: product._id,
          productName: product.name,
          oldStock: product.stock - quantity,
          newStock: product.stock,
        },
      };
    } catch (error) {
      logger.error("Lỗi khi cập nhật tồn kho", {
        error: error.message,
        productId,
      });
      return {
        success: false,
        message: "Lỗi khi cập nhật tồn kho",
      };
    }
  }

  /**
   * Lấy trạng thái tồn kho
   * @param {number} stock
   * @returns {string}
   */
  getStockStatus(stock) {
    if (stock <= 0) return "out_of_stock";
    if (stock <= 5) return "low_stock";
    if (stock <= 20) return "limited_stock";
    return "in_stock";
  }

  /**
   * Lấy message hiển thị cho user
   * @param {number} stock
   * @returns {string}
   */
  getStockMessage(stock) {
    const status = this.getStockStatus(stock);

    const messages = {
      out_of_stock: "❌ Hết hàng",
      low_stock: "⚠️ Chỉ còn rất ít (dưới 5 sản phẩm)",
      limited_stock: "⚡ Số lượng có hạn",
      in_stock: "✅ Còn hàng",
    };

    return messages[status] || "Không rõ";
  }

  /**
   * Thống kê tồn kho
   * @returns {Promise<Object>}
   */
  async getStockStatistics() {
    try {
      const stats = await Product.aggregate([
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalStock: { $sum: "$stock" },
            inStock: {
              $sum: { $cond: [{ $gt: ["$stock", 0] }, 1, 0] },
            },
            outOfStock: {
              $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] },
            },
            lowStock: {
              $sum: {
                $cond: [
                  { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", 5] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      return (
        stats[0] || {
          totalProducts: 0,
          totalStock: 0,
          inStock: 0,
          outOfStock: 0,
          lowStock: 0,
        }
      );
    } catch (error) {
      logger.error("Lỗi khi lấy thống kê tồn kho", { error: error.message });
      return null;
    }
  }

  /**
   * Đặt hàng và giảm tồn kho
   * @param {Array} items - [{ productId, quantity }]
   * @returns {Promise<Object>}
   */
  async reserveStock(items) {
    try {
      const reservations = [];
      const errors = [];

      for (const item of items) {
        const product = await Product.findById(item.productId);

        if (!product) {
          errors.push({
            productId: item.productId,
            error: "Không tìm thấy sản phẩm",
          });
          continue;
        }

        if (product.stock < item.quantity) {
          errors.push({
            productId: item.productId,
            productName: product.name,
            error: "Tồn kho không đủ",
            requested: item.quantity,
            available: product.stock,
          });
          continue;
        }

        product.stock -= item.quantity;
        await product.save();

        reservations.push({
          productId: product._id,
          productName: product.name,
          quantity: item.quantity,
          remainingStock: product.stock,
        });
      }

      return {
        success: errors.length === 0,
        reservations,
        errors,
      };
    } catch (error) {
      logger.error("Lỗi khi đặt hàng", { error: error.message });
      return {
        success: false,
        message: "Lỗi khi đặt hàng",
      };
    }
  }
}

module.exports = StockService;
