const Product = require("../models/Product");
const Brand = require("../models/Brand");
const Category = require("../models/Category");

/**
 * Service tìm kiếm sản phẩm thông minh dựa trên natural language query
 */
class ProductSearchService {
  /**
   * Phân tích query và tìm sản phẩm phù hợp
   * @param {String} query - Câu hỏi của user (VD: "điện thoại pin trâu dưới 10 triệu")
   * @returns {Array} - Danh sách sản phẩm phù hợp
   */
  async searchProducts(query) {
    const filters = await this.extractFilters(query);

    // Ưu tiên tìm theo tên sản phẩm nếu có tên cụ thể trong câu hỏi
    const queryLower = query.toLowerCase();

    // Bước 0: Tìm kiếm chính xác theo tên sản phẩm cụ thể (EXACT MATCH - ƯU TIÊN CAO NHẤT)
    // Pattern để trích xuất tên sản phẩm cụ thể (brand + model + variant)
    const exactProductMatch = query.match(
      /(iphone|ipad|samsung galaxy|galaxy|xiaomi pad|xiaomi|redmi|oppo|vivo|realme|nokia|airpod|airpods|tai nghe|headphone|earphone)\s*(\d{0,2}[\s\w]*(?:pro|max|ultra|plus|mini|note|air|se|pro max|ultra max)?)/i
    );

    if (exactProductMatch) {
      const fullMatch = exactProductMatch[0].trim();

      // Tìm sản phẩm có tên chứa chuỗi này (case-insensitive, flexible spacing)
      const exactProducts = await Product.find({
        name: { $regex: new RegExp(fullMatch.replace(/\s+/g, "\\s*"), "i") },
      })
        .populate("brand", "name logo")
        .populate("category", "name")
        .limit(20);

      if (exactProducts.length > 0) {
        console.log(
          `🎯 Exact match found ${exactProducts.length} products for "${fullMatch}"`
        );

        // Scoring: Ưu tiên sản phẩm match chính xác nhất
        const scoredProducts = exactProducts.map((product) => {
          const productNameLower = product.name.toLowerCase();
          const queryTerms = fullMatch.toLowerCase().split(/\s+/);

          let score = 0;

          // +100 điểm nếu tên sản phẩm bắt đầu với query
          if (productNameLower.startsWith(fullMatch.toLowerCase())) {
            score += 100;
          }

          // +50 điểm nếu tên sản phẩm chứa toàn bộ query liên tiếp
          if (productNameLower.includes(fullMatch.toLowerCase())) {
            score += 50;
          }

          // +10 điểm cho mỗi từ khóa khớp
          queryTerms.forEach((term) => {
            if (productNameLower.includes(term)) {
              score += 10;
            }
          });

          // -0.1 điểm cho mỗi ký tự chênh lệch về độ dài (giảm penalty)
          const lengthDiff = Math.abs(
            productNameLower.length - fullMatch.length
          );
          score -= lengthDiff * 0.1;

          console.log(`   Product: "${product.name}" → Score: ${score}`);
          return { product, score };
        });

        // Sắp xếp theo điểm số giảm dần
        scoredProducts.sort((a, b) => b.score - a.score);

        console.log(
          `✅ Top result: "${scoredProducts[0]?.product.name}" (score: ${scoredProducts[0]?.score})`
        );

        // Trả về danh sách sản phẩm đã được sắp xếp
        return scoredProducts.map((item) => item.product);
      } else {
        console.log(`❌ No exact match for "${fullMatch}"`);
      }
    }

    // Bước 1: Thử tìm kiếm trực tiếp theo tên sản phẩm (linh hoạt hơn)
    // Loại bỏ các từ phổ biến không liên quan (GIỮ LẠI TÊN SẢN PHẨM)
    const stopWords = [
      "giá",
      "còn",
      "hàng",
      "không",
      "có",
      "bao",
      "nhiêu",
      "tiền",
      "mua",
      "bán",
      "xem",
      "cho",
      "tôi",
      "tất",
      "cả",
      "nào",
      "thế",
      "là",
      "của",
      "và",
      "trả",
      "góp",
      "như",
      "thế",
      "nào",
      "phải",
      "được",
      "này",
      "đó",
      "ạ",
      "nhé",
    ];
    let searchTerms = query.toLowerCase();
    stopWords.forEach((word) => {
      searchTerms = searchTerms.replace(new RegExp(`\\b${word}\\b`, "g"), " ");
    });
    searchTerms = searchTerms
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    let products = [];

    // Nếu có từ khóa tìm kiếm (sau khi loại stopwords)
    if (searchTerms.length > 2) {
      // Tìm kiếm gần đúng với $regex
      const searchPattern = searchTerms
        .split(" ")
        .filter((w) => w.length > 1)
        .join(".*");
      if (searchPattern.length > 2) {
        products = await Product.find({
          name: { $regex: new RegExp(searchPattern, "i") },
        })
          .populate("brand", "name logo")
          .populate("category", "name")
          .limit(10);

        if (products.length > 0) return products;
      }
    }

    // Bước 2: Thử tìm theo regex brand cố định (fallback) - LINH HOẠT HƠN
    const nameMatch = query.match(
      /(iphone|ipad|samsung galaxy|galaxy|xiaomi pad|xiaomi|oppo|vivo|realme|macbook|nokia|redmi|airpod|airpods|tai nghe|headphone|earphone)\s*[\w\s]*?(\d{0,3}(?:\s*(?:pro|max|ultra|plus|mini|note|air|se))*)/i
    );

    if (nameMatch) {
      let name = nameMatch[0]
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (name.length > 2) {
        products = await Product.find({
          name: { $regex: new RegExp(name.replace(/ /g, "\\s*"), "i") },
        })
          .populate("brand", "name logo")
          .populate("category", "name")
          .limit(10);

        if (products.length > 0) return products;
      }
    }

    // Bước 3: Nếu không tìm thấy theo tên, dùng bộ lọc như cũ
    console.log("Fallback to findProducts với filters:", filters);
    products = await this.findProducts(filters);

    if (products.length === 0) {
      console.log("Không tìm thấy sản phẩm nào với tất cả các bước");
      // Bước 4: Last resort - tìm sản phẩm tương tự theo brand
      const brandMatch = query.match(
        /(iphone|ipad|samsung|xiaomi|oppo|vivo|realme|nokia|airpod|tai nghe|headphone)/i
      );
      if (brandMatch) {
        const brand = brandMatch[1];
        console.log(`Last resort: Tìm sản phẩm ${brand} bất kỳ`);
        products = await Product.find({
          name: { $regex: new RegExp(brand, "i") },
          stock: { $gt: 0 },
        })
          .populate("brand", "name logo")
          .populate("category", "name")
          .limit(10);
      }
    }

    return products;
  }

  /**
   * Trích xuất bộ lọc từ natural language query
   */
  async extractFilters(query) {
    const filters = {};
    const queryLower = query.toLowerCase();

    // Lọc theo giá
    const pricePatterns = [
      { pattern: /dưới (\d+) triệu/i, max: true },
      { pattern: /trên (\d+) triệu/i, min: true },
      { pattern: /từ (\d+) đến (\d+) triệu/i, range: true },
      { pattern: /khoảng (\d+) triệu/i, around: true },
    ];

    for (const { pattern, max, min, range, around } of pricePatterns) {
      const match = query.match(pattern);
      if (match) {
        if (range) {
          filters.price = {
            $gte: parseInt(match[1]) * 1000000,
            $lte: parseInt(match[2]) * 1000000,
          };
        } else if (max) {
          filters.price = { $lte: parseInt(match[1]) * 1000000 };
        } else if (min) {
          filters.price = { $gte: parseInt(match[1]) * 1000000 };
        } else if (around) {
          const price = parseInt(match[1]) * 1000000;
          filters.price = { $gte: price - 2000000, $lte: price + 2000000 };
        }
        break;
      }
    }

    // Lọc theo pin
    if (
      queryLower.includes("pin trâu") ||
      queryLower.includes("pin khủng") ||
      queryLower.includes("pin lớn")
    ) {
      filters.battery = { $gte: 5000 };
    } else if (queryLower.includes("pin tốt")) {
      filters.battery = { $gte: 4500 };
    }

    // Lọc theo RAM
    const ramMatch = query.match(/(\d+)\s*gb\s*ram/i);
    if (ramMatch) {
      filters.ram = { $gte: parseInt(ramMatch[1]) };
    }

    // Lọc theo bộ nhớ
    const storageMatch = query.match(/(\d+)\s*gb\s*(bộ nhớ|lưu trữ|rom)/i);
    if (storageMatch) {
      filters.storage = { $gte: parseInt(storageMatch[1]) };
    }

    // Lọc theo camera
    if (
      queryLower.includes("camera tốt") ||
      queryLower.includes("chụp ảnh đẹp")
    ) {
      // Tìm sản phẩm có camera rear bắt đầu bằng số lớn (48MP+)
      filters.cameraRear = { $regex: /^(4[8-9]|[5-9]\d|1\d{2})MP/i };
    }

    // Lọc theo màn hình
    if (queryLower.includes("màn hình lớn") || queryLower.includes("màn to")) {
      filters.displaySize = { $gte: 6.5 };
    }

    // Lọc theo brand
    const brands = [
      "samsung",
      "iphone",
      "apple",
      "xiaomi",
      "oppo",
      "vivo",
      "realme",
      "nokia",
    ];
    for (const brand of brands) {
      if (queryLower.includes(brand)) {
        const brandDoc = await Brand.findOne({ name: new RegExp(brand, "i") });
        if (brandDoc) {
          filters.brand = brandDoc._id;
        }
        break;
      }
    }

    // Sản phẩm gaming
    if (queryLower.includes("gaming") || queryLower.includes("chơi game")) {
      filters.$or = [
        { chipset: { $regex: /(snapdragon 8|dimensity 9|a17|a16)/i } },
        { ram: { $gte: 8 } },
      ];
    }

    // Sản phẩm mới
    if (queryLower.includes("mới nhất") || queryLower.includes("ra mắt")) {
      filters.isLatest = true;
    }

    // Sản phẩm bán chạy
    if (queryLower.includes("bán chạy") || queryLower.includes("phổ biến")) {
      filters.sold = { $gte: 50 };
    }

    // Sản phẩm giảm giá
    if (
      queryLower.includes("giảm giá") ||
      queryLower.includes("khuyến mãi") ||
      queryLower.includes("sale")
    ) {
      filters.discount = { $gt: 0 };
    }

    return filters;
  }

  /**
   * Tìm sản phẩm dựa trên filters
   */
  async findProducts(filters, limit = 10) {
    try {
      let query = Product.find(filters)
        .populate("brand", "name logo")
        .populate("category", "name")
        .limit(limit);

      // Sắp xếp theo độ phù hợp
      if (filters.sold) {
        query = query.sort({ sold: -1, rating: -1 });
      } else if (filters.isLatest) {
        query = query.sort({ createdAt: -1 });
      } else if (filters.discount) {
        query = query.sort({ discount: -1 });
      } else {
        query = query.sort({ rating: -1, sold: -1 });
      }

      const products = await query;
      return products;
    } catch (error) {
      console.error("Error finding products:", error);
      return [];
    }
  }

  /**
   * So sánh 2 sản phẩm
   */
  async compareProducts(productId1, productId2) {
    try {
      const [product1, product2] = await Promise.all([
        Product.findById(productId1).populate("brand category"),
        Product.findById(productId2).populate("brand category"),
      ]);

      if (!product1 || !product2) {
        return null;
      }

      const comparison = {
        products: [product1, product2],
        differences: {},
      };

      // So sánh các thông số chính
      const specs = [
        "price",
        "ram",
        "storage",
        "battery",
        "displaySize",
        "chipset",
      ];
      specs.forEach((spec) => {
        if (product1[spec] !== product2[spec]) {
          comparison.differences[spec] = {
            product1: product1[spec],
            product2: product2[spec],
          };
        }
      });

      return comparison;
    } catch (error) {
      console.error("Error comparing products:", error);
      return null;
    }
  }

  /**
   * Lấy chi tiết sản phẩm
   */
  async getProductDetails(productId) {
    try {
      const product = await Product.findById(productId)
        .populate("brand", "name logo")
        .populate("category", "name");
      return product;
    } catch (error) {
      console.error("Error getting product details:", error);
      return null;
    }
  }

  /**
   * Gợi ý sản phẩm tương tự
   */
  async getSimilarProducts(productId, limit = 5) {
    try {
      const product = await Product.findById(productId);
      if (!product) return [];

      const filters = {
        _id: { $ne: productId },
        category: product.category,
        price: {
          $gte: product.price * 0.7,
          $lte: product.price * 1.3,
        },
      };

      const similar = await Product.find(filters)
        .populate("brand", "name logo")
        .populate("category", "name")
        .sort({ rating: -1, sold: -1 })
        .limit(limit);

      return similar;
    } catch (error) {
      console.error("Error getting similar products:", error);
      return [];
    }
  }

  /**
   * Kiểm tra tồn kho
   */
  async checkStock(productId, variant = null) {
    try {
      const product = await Product.findById(productId);
      if (!product)
        return { available: false, message: "Sản phẩm không tồn tại" };

      // Nếu có variant, kiểm tra tồn kho cho variant đó
      if (variant) {
        const foundVariant = product.variants.find(
          (v) =>
            (!variant.ram || v.ram === variant.ram) &&
            (!variant.storage || v.storage === variant.storage)
        );
        if (foundVariant) {
          // Nếu có trường stock riêng cho variant, dùng nó, nếu không thì dùng product.stock
          const variantStock =
            foundVariant.stock !== undefined
              ? foundVariant.stock
              : product.stock;
          return {
            available: variantStock > 0,
            stock: variantStock,
            variant: foundVariant,
            message:
              variantStock > 0
                ? `Phiên bản RAM ${foundVariant.ram}GB, ROM ${foundVariant.storage}GB còn ${variantStock} sản phẩm trong kho`
                : `Phiên bản RAM ${foundVariant.ram}GB, ROM ${foundVariant.storage}GB tạm hết hàng`,
          };
        } else {
          return {
            available: false,
            message: "Không tìm thấy phiên bản yêu cầu",
          };
        }
      }

      // Nếu không có variant, trả về tất cả phiên bản
      if (product.variants && product.variants.length > 0) {
        const variantStocks = product.variants.map((v) => {
          const variantStock = v.stock !== undefined ? v.stock : product.stock;
          return {
            ram: v.ram,
            storage: v.storage,
            price: v.price,
            stock: variantStock,
            available: variantStock > 0,
            message:
              variantStock > 0
                ? `Phiên bản RAM ${v.ram}GB, ROM ${v.storage}GB còn ${variantStock} sản phẩm trong kho`
                : `Phiên bản RAM ${v.ram}GB, ROM ${v.storage}GB tạm hết hàng`,
          };
        });
        return {
          available: variantStocks.some((v) => v.available),
          variants: variantStocks,
          message: `Danh sách tồn kho các phiên bản của sản phẩm "${product.name}":`,
        };
      }

      // Nếu không có variants, trả về tồn kho tổng
      if (product.stock > 0) {
        return {
          available: true,
          stock: product.stock,
          message: `Còn ${product.stock} sản phẩm trong kho`,
        };
      } else {
        return {
          available: false,
          stock: 0,
          message: "Sản phẩm tạm hết hàng",
        };
      }
    } catch (error) {
      console.error("Error checking stock:", error);
      return { available: false, message: "Lỗi kiểm tra tồn kho" };
    }
  }
}

module.exports = new ProductSearchService();
