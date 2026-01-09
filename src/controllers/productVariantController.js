// src/controllers/productVariantController.js
const Product = require("../models/Product");

// Existing method for RAM/Storage variants
exports.getProductVariants = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).select("variants name");
    if (!product) {
      return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
    }
    res.json({
      productId,
      name: product.name,
      variants: product.variants || [],
    });
  } catch (err) {
    console.error("Lỗi lấy variants sản phẩm:", err);
    res.status(500).json({ error: "Lỗi lấy variants sản phẩm", details: err });
  }
};

/**
 * @desc    Get all color variants for a product
 * @route   GET /api/products/:id/color-variants
 * @access  Public
 */
exports.getColorVariants = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).select(
      "name colorVariants price images"
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    // If no colorVariants, return default product info
    if (!product.colorVariants || product.colorVariants.length === 0) {
      return res.json({
        success: true,
        data: {
          productName: product.name,
          basePrice: product.price,
          defaultImages: product.images,
          variants: [],
        },
      });
    }

    res.json({
      success: true,
      data: {
        productName: product.name,
        basePrice: product.price,
        variants: product.colorVariants.map((variant) => ({
          _id: variant._id,
          color: variant.color,
          colorCode: variant.colorCode,
          images: variant.images,
          stock: variant.stock,
          sku: variant.sku,
        })),
      },
    });
  } catch (error) {
    console.error("Get color variants error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin màu sắc",
    });
  }
};

/**
 * @desc    Add color variant to product (Admin)
 * @route   POST /api/products/:id/color-variants
 * @access  Private/Admin
 */
exports.addColorVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const { color, colorCode, images, stock, sku } = req.body;

    if (!color) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp tên màu",
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    // Initialize colorVariants if doesn't exist
    if (!product.colorVariants) {
      product.colorVariants = [];
    }

    // Check if color already exists
    const existingVariant = product.colorVariants.find(
      (v) => v.color.toLowerCase() === color.toLowerCase()
    );

    if (existingVariant) {
      return res.status(400).json({
        success: false,
        message: `Màu ${color} đã tồn tại`,
      });
    }

    // Add new variant
    product.colorVariants.push({
      color,
      colorCode,
      images: images || [],
      stock: stock || 0,
      sku,
    });

    await product.save();

    res.json({
      success: true,
      message: `Đã thêm màu ${color}`,
      data: product.colorVariants[product.colorVariants.length - 1],
    });
  } catch (error) {
    console.error("Add color variant error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm màu sắc",
    });
  }
};

/**
 * @desc    Update color variant (Admin)
 * @route   PUT /api/products/:id/color-variants/:variantId
 * @access  Private/Admin
 */
exports.updateColorVariant = async (req, res) => {
  try {
    const { id, variantId } = req.params;
    const { color, colorCode, images, stock, sku } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    const variant = product.colorVariants.id(variantId);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy màu sắc này",
      });
    }

    // Update fields
    if (color) variant.color = color;
    if (colorCode) variant.colorCode = colorCode;
    if (images) variant.images = images;
    if (stock !== undefined) variant.stock = stock;
    if (sku) variant.sku = sku;

    await product.save();

    res.json({
      success: true,
      message: "Cập nhật màu sắc thành công",
      data: variant,
    });
  } catch (error) {
    console.error("Update color variant error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật màu sắc",
    });
  }
};

/**
 * @desc    Delete color variant (Admin)
 * @route   DELETE /api/products/:id/color-variants/:variantId
 * @access  Private/Admin
 */
exports.deleteColorVariant = async (req, res) => {
  try {
    const { id, variantId } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    const variant = product.colorVariants.id(variantId);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy màu sắc này",
      });
    }

    const colorName = variant.color;

    // Xóa bằng cách filter array
    product.colorVariants = product.colorVariants.filter(
      (v) => v._id.toString() !== variantId
    );

    await product.save();

    res.json({
      success: true,
      message: `Đã xóa màu ${colorName}`,
    });
  } catch (error) {
    console.error("Delete color variant error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa màu sắc",
    });
  }
};
