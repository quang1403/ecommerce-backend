// src/controllers/analyticsController.js
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");

// Thống kê doanh thu theo khoảng thời gian tùy chỉnh
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query; // day, week, month, year

    const matchCondition = { status: 3 }; // Chỉ tính đơn đã giao
    if (startDate && endDate) {
      matchCondition.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    let groupId;
    switch (groupBy) {
      case "week":
        groupId = {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" },
        };
        break;
      case "month":
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        break;
      case "quarter":
        groupId = {
          year: { $year: "$createdAt" },
          quarter: {
            $ceil: { $divide: [{ $month: "$createdAt" }, 3] },
          },
        };
        break;
      case "year":
        groupId = { year: { $year: "$createdAt" } };
        break;
      default: // day
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        };
    }

    const revenueAnalytics = await Order.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: groupId,
          totalRevenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: "$total" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    res.json({ revenueAnalytics, groupBy, period: { startDate, endDate } });
  } catch (err) {
    console.error("Lỗi phân tích doanh thu:", err);
    res.status(500).json({ error: "Lỗi phân tích doanh thu", details: err });
  }
};

// Phân tích hành vi khách hàng
exports.getCustomerAnalytics = async (req, res) => {
  try {
    // Top khách hàng VIP (mua nhiều nhất)
    const topCustomers = await Order.aggregate([
      { $match: { status: 3 } },
      {
        $group: {
          _id: "$customerId",
          totalSpent: { $sum: "$total" },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: "$total" },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
    ]);

    // Phân tích tần suất mua hàng
    const customerFrequency = await Order.aggregate([
      { $match: { status: 3 } },
      {
        $group: {
          _id: "$customerId",
          orderCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$orderCount",
          customerCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Thống kê theo phương thức thanh toán
    const paymentMethodStats = await Order.aggregate([
      { $match: { status: 3 } },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$total" },
          avgValue: { $avg: "$total" },
        },
      },
    ]);

    res.json({
      topCustomers,
      customerFrequency,
      paymentMethodStats,
    });
  } catch (err) {
    console.error("Lỗi phân tích khách hàng:", err);
    res.status(500).json({ error: "Lỗi phân tích khách hàng", details: err });
  }
};

// Phân tích sản phẩm chi tiết
exports.getProductAnalytics = async (req, res) => {
  try {
    // Sản phẩm bán chạy theo thể loại
    const productsByCategory = await Order.aggregate([
      { $match: { status: 3 } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.category",
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
          productCount: { $addToSet: "$items.productId" },
        },
      },
      {
        $addFields: {
          uniqueProductCount: { $size: "$productCount" },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    // Sản phẩm có tỷ lệ conversion cao
    const productConversion = await Product.aggregate([
      {
        $lookup: {
          from: "orders",
          let: { productId: "$_id" },
          pipeline: [
            { $match: { status: 3 } },
            { $unwind: "$items" },
            {
              $match: {
                $expr: { $eq: ["$items.productId", "$$productId"] },
              },
            },
            {
              $group: {
                _id: null,
                totalQuantity: { $sum: "$items.quantity" },
                totalRevenue: {
                  $sum: { $multiply: ["$items.quantity", "$items.price"] },
                },
              },
            },
          ],
          as: "sales",
        },
      },
      {
        $addFields: {
          totalSold: {
            $ifNull: [{ $arrayElemAt: ["$sales.totalQuantity", 0] }, 0],
          },
          totalRevenue: {
            $ifNull: [{ $arrayElemAt: ["$sales.totalRevenue", 0] }, 0],
          },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 20 },
    ]);

    res.json({
      productsByCategory,
      productConversion,
    });
  } catch (err) {
    console.error("Lỗi phân tích sản phẩm:", err);
    res.status(500).json({ error: "Lỗi phân tích sản phẩm", details: err });
  }
};

// Phân tích xu hướng và dự đoán
exports.getTrendAnalytics = async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    // Xu hướng doanh thu theo tháng
    const revenueTrend = await Order.aggregate([
      {
        $match: {
          status: 3,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalRevenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: "$total" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Xu hướng đăng ký user mới
    const userTrend = await User.aggregate([
      {
        $match: {
          isAdmin: { $ne: true },
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          newUsers: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Tỷ lệ hoàn thành đơn hàng
    const orderStatusTrend = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.json({
      revenueTrend,
      userTrend,
      orderStatusTrend,
      period: { months, startDate },
    });
  } catch (err) {
    console.error("Lỗi phân tích xu hướng:", err);
    res.status(500).json({ error: "Lỗi phân tích xu hướng", details: err });
  }
};

// Báo cáo tổng hợp cho một khoảng thời gian
exports.getComprehensiveReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Cần cung cấp startDate và endDate" });
    }

    const matchCondition = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };

    // Tổng quan trong khoảng thời gian
    const overview = await Order.aggregate([
      { $match: { ...matchCondition, status: 3 } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: "$total" },
        },
      },
    ]);

    const totalOrders = await Order.countDocuments(matchCondition);
    const newUsers = await User.countDocuments({
      ...matchCondition,
      isAdmin: { $ne: true },
    });

    // Top 5 sản phẩm bán chạy trong kỳ
    const topProducts = await Order.aggregate([
      { $match: { ...matchCondition, status: 3 } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
    ]);

    res.json({
      period: { startDate, endDate },
      overview: overview[0] || {
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
      },
      totalOrders,
      newUsers,
      topProducts,
    });
  } catch (err) {
    console.error("Lỗi báo cáo tổng hợp:", err);
    res.status(500).json({ error: "Lỗi báo cáo tổng hợp", details: err });
  }
};
