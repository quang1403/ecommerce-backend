const Product = require("../models/Product");

// Kiểm tra tồn kho của một sản phẩm
exports.checkStock = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId).select("stock name");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không tồn tại",
      });
    }

    res.json({
      success: true,
      data: {
        productId: product._id,
        productName: product.name,
        stock: product.stock,
        status: product.stock > 0 ? "Còn hàng" : "Hết hàng",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi kiểm tra tồn kho",
      error: error.message,
    });
  }
};

// Cập nhật số lượng tồn kho (Admin)
exports.updateStock = async (req, res) => {
  try {
    const { productId } = req.params;
    const { stock, action } = req.body; // action: 'set', 'add', 'subtract'

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không tồn tại",
      });
    }

    let newStock;
    switch (action) {
      case "set":
        newStock = Number(stock);
        break;
      case "add":
        newStock = product.stock + Number(stock);
        break;
      case "subtract":
        newStock = product.stock - Number(stock);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Action không hợp lệ (set/add/subtract)",
        });
    }

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: "Số lượng tồn kho không thể âm",
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { stock: newStock },
      { new: true }
    ).select("stock name");

    res.json({
      success: true,
      message: "Cập nhật tồn kho thành công",
      data: {
        productId: updatedProduct._id,
        productName: updatedProduct.name,
        oldStock: product.stock,
        newStock: updatedProduct.stock,
        action,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật tồn kho",
      error: error.message,
    });
  }
};

// Lấy danh sách sản phẩm sắp hết hàng (Admin)
exports.getLowStockProducts = async (req, res) => {
  try {
    const { threshold = 10 } = req.query; // Ngưỡng cảnh báo (mặc định 10)

    const lowStockProducts = await Product.find({
      stock: { $lte: Number(threshold), $gt: 0 },
    })
      .select("name stock price images category brand")
      .populate("category", "name")
      .populate("brand", "name")
      .sort({ stock: 1 });

    res.json({
      success: true,
      data: lowStockProducts,
      total: lowStockProducts.length,
      threshold: Number(threshold),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách sản phẩm sắp hết hàng",
      error: error.message,
    });
  }
};

// Lấy danh sách sản phẩm hết hàng (Admin)
exports.getOutOfStockProducts = async (req, res) => {
  try {
    const outOfStockProducts = await Product.find({ stock: { $lte: 0 } })
      .select("name stock price images category brand")
      .populate("category", "name")
      .populate("brand", "name")
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: outOfStockProducts,
      total: outOfStockProducts.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách sản phẩm hết hàng",
      error: error.message,
    });
  }
};

// Báo cáo tồn kho tổng quan (Admin)
exports.getInventoryReport = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const outOfStockCount = await Product.countDocuments({
      stock: { $lte: 0 },
    });
    const lowStockCount = await Product.countDocuments({
      stock: { $lte: 10, $gt: 0 },
    });
    const inStockCount = await Product.countDocuments({ stock: { $gt: 10 } });

    const totalStockValue = await Product.aggregate([
      { $match: { stock: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ["$stock", "$price"] } },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        totalProducts,
        outOfStockCount,
        lowStockCount,
        inStockCount,
        totalStockValue: totalStockValue[0]?.total || 0,
        stockStatus: {
          outOfStock:
            ((outOfStockCount / totalProducts) * 100).toFixed(2) + "%",
          lowStock: ((lowStockCount / totalProducts) * 100).toFixed(2) + "%",
          inStock: ((inStockCount / totalProducts) * 100).toFixed(2) + "%",
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy báo cáo tồn kho",
      error: error.message,
    });
  }
};

// Cập nhật tồn kho hàng loạt (Admin)
exports.bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body; // [{ productId, stock, action }]

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách cập nhật không hợp lệ",
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { productId, stock, action } = update;
        const product = await Product.findById(productId);

        if (!product) {
          errors.push({ productId, error: "Sản phẩm không tồn tại" });
          continue;
        }

        let newStock;
        switch (action) {
          case "set":
            newStock = Number(stock);
            break;
          case "add":
            newStock = product.stock + Number(stock);
            break;
          case "subtract":
            newStock = product.stock - Number(stock);
            break;
          default:
            errors.push({ productId, error: "Action không hợp lệ" });
            continue;
        }

        if (newStock < 0) {
          errors.push({ productId, error: "Số lượng tồn kho không thể âm" });
          continue;
        }

        await Product.findByIdAndUpdate(productId, { stock: newStock });
        results.push({
          productId,
          productName: product.name,
          oldStock: product.stock,
          newStock,
          action,
        });
      } catch (err) {
        errors.push({ productId: update.productId, error: err.message });
      }
    }

    res.json({
      success: true,
      message: "Cập nhật tồn kho hàng loạt hoàn thành",
      data: {
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật tồn kho hàng loạt",
      error: error.message,
    });
  }
};
