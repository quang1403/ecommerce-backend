// src/controllers/analyticsController.js
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");

// Thống kê doanh thu theo khoảng thời gian tùy chỉnh
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query; // day, week, month, quarter, year

    // Xác định khoảng thời gian mặc định nếu không có
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const matchCondition = {
      status: 3, // Chỉ tính đơn đã giao
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

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

    // Lấy dữ liệu thực tế từ database
    const revenueData = await Order.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: groupId,
          totalRevenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: "$total" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
          "_id.week": 1,
          "_id.quarter": 1,
        },
      },
    ]);

    // Tạo mảng đầy đủ dữ liệu theo groupBy
    let revenueAnalytics = [];

    switch (groupBy) {
      case "day": {
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1;
          const day = currentDate.getDate();

          const dayData = revenueData.find(
            (item) =>
              item._id.year === year &&
              item._id.month === month &&
              item._id.day === day
          );

          revenueAnalytics.push({
            _id: { year, month, day },
            totalRevenue: dayData?.totalRevenue || 0,
            orderCount: dayData?.orderCount || 0,
            avgOrderValue: dayData?.avgOrderValue || 0,
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }
        break;
      }

      case "week": {
        const currentDate = new Date(start);
        const weeks = new Set();

        while (currentDate <= end) {
          const year = currentDate.getFullYear();
          const startOfYear = new Date(year, 0, 1);
          const days = Math.floor(
            (currentDate - startOfYear) / (24 * 60 * 60 * 1000)
          );
          const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);

          const weekKey = `${year}-${week}`;
          if (!weeks.has(weekKey)) {
            weeks.add(weekKey);

            const weekData = revenueData.find(
              (item) => item._id.year === year && item._id.week === week
            );

            revenueAnalytics.push({
              _id: { year, week },
              totalRevenue: weekData?.totalRevenue || 0,
              orderCount: weekData?.orderCount || 0,
              avgOrderValue: weekData?.avgOrderValue || 0,
            });
          }

          currentDate.setDate(currentDate.getDate() + 7);
        }
        break;
      }

      case "month": {
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1;

          const monthData = revenueData.find(
            (item) => item._id.year === year && item._id.month === month
          );

          revenueAnalytics.push({
            _id: { year, month },
            totalRevenue: monthData?.totalRevenue || 0,
            orderCount: monthData?.orderCount || 0,
            avgOrderValue: monthData?.avgOrderValue || 0,
          });

          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        break;
      }

      case "quarter": {
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const year = currentDate.getFullYear();
          const quarter = Math.ceil((currentDate.getMonth() + 1) / 3);

          const quarterData = revenueData.find(
            (item) => item._id.year === year && item._id.quarter === quarter
          );

          revenueAnalytics.push({
            _id: { year, quarter },
            totalRevenue: quarterData?.totalRevenue || 0,
            orderCount: quarterData?.orderCount || 0,
            avgOrderValue: quarterData?.avgOrderValue || 0,
          });

          currentDate.setMonth(currentDate.getMonth() + 3);
        }
        break;
      }

      case "year": {
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();

        for (let year = startYear; year <= endYear; year++) {
          const yearData = revenueData.find((item) => item._id.year === year);

          revenueAnalytics.push({
            _id: { year },
            totalRevenue: yearData?.totalRevenue || 0,
            orderCount: yearData?.orderCount || 0,
            avgOrderValue: yearData?.avgOrderValue || 0,
          });
        }
        break;
      }
    }

    res.json({
      revenueAnalytics,
      groupBy,
      period: { startDate: start, endDate: end },
    });
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
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    // Xu hướng doanh thu theo tháng - Lấy dữ liệu thực tế
    const revenueData = await Order.aggregate([
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

    // Tạo mảng đầy đủ cho xu hướng doanh thu
    const revenueTrend = [];
    const currentDate = new Date();

    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(currentDate.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const monthData = revenueData.find(
        (item) => item._id.year === year && item._id.month === month
      );

      revenueTrend.push({
        _id: { year, month },
        totalRevenue: monthData?.totalRevenue || 0,
        orderCount: monthData?.orderCount || 0,
        avgOrderValue: monthData?.avgOrderValue || 0,
      });
    }

    // Xu hướng đăng ký user mới - Lấy dữ liệu thực tế
    const userData = await User.aggregate([
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

    // Tạo mảng đầy đủ cho xu hướng user
    const userTrend = [];

    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(currentDate.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const monthData = userData.find(
        (item) => item._id.year === year && item._id.month === month
      );

      userTrend.push({
        _id: { year, month },
        newUsers: monthData?.newUsers || 0,
      });
    }

    // Tỷ lệ hoàn thành đơn hàng - Lấy dữ liệu thực tế
    const orderStatusData = await Order.aggregate([
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

    // Tạo mảng đầy đủ cho xu hướng trạng thái đơn hàng
    const orderStatusTrend = [];
    const statuses = [0, 1, 2, 3, 4]; // Tất cả các trạng thái

    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(currentDate.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Thêm dữ liệu cho từng trạng thái trong tháng
      statuses.forEach((status) => {
        const statusData = orderStatusData.find(
          (item) =>
            item._id.year === year &&
            item._id.month === month &&
            item._id.status === status
        );

        orderStatusTrend.push({
          _id: { year, month, status },
          count: statusData?.count || 0,
        });
      });
    }

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
