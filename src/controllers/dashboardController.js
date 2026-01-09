// src/controllers/dashboardController.js
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");

// Thống kê tổng quan
exports.getDashboardStats = async (req, res) => {
  try {
    // Đếm tổng số
    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } }); // Chỉ đếm user thường, không bao gồm admin
    const totalProducts = await Product.countDocuments();

    // Tổng doanh thu (chỉ tính đơn đã giao thành công)
    const revenueResult = await Order.aggregate([
      { $match: { status: 3 } }, // Chỉ tính đơn hàng đã giao (status = 3)
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    // Đơn hàng theo trạng thái
    const ordersByStatus = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    res.json({
      totalOrders,
      totalUsers,
      totalProducts,
      totalRevenue,
      ordersByStatus,
    });
  } catch (err) {
    console.error("Lỗi lấy thống kê dashboard:", err);
    res.status(500).json({ error: "Lỗi lấy thống kê dashboard", details: err });
  }
};

// Thống kê doanh thu theo tháng (12 tháng gần nhất)
exports.getRevenueByMonth = async (req, res) => {
  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1); // Bắt đầu từ ngày 1 của tháng
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    // Lấy dữ liệu thực tế từ database
    const revenueData = await Order.aggregate([
      {
        $match: {
          status: 3, // Chỉ tính đơn hàng đã giao thành công
          createdAt: { $gte: twelveMonthsAgo },
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
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Tạo mảng đầy đủ 12 tháng
    const revenueByMonth = [];
    const currentDate = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(currentDate.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Tìm dữ liệu tương ứng với tháng này
      const monthData = revenueData.find(
        (item) => item._id.year === year && item._id.month === month
      );

      revenueByMonth.push({
        _id: { year, month },
        totalRevenue: monthData?.totalRevenue || 0,
        orderCount: monthData?.orderCount || 0,
      });
    }

    res.json({ revenueByMonth });
  } catch (err) {
    console.error("Lỗi lấy thống kê doanh thu theo tháng:", err);
    res
      .status(500)
      .json({ error: "Lỗi lấy thống kê doanh thu theo tháng", details: err });
  }
};

// Top sản phẩm bán chạy
exports.getTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topProducts = await Order.aggregate([
      { $match: { status: 3 } }, // Chỉ tính đơn hàng đã giao thành công
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
      { $limit: parseInt(limit) },
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

    res.json({ topProducts });
  } catch (err) {
    console.error("Lỗi lấy top sản phẩm bán chạy:", err);
    res
      .status(500)
      .json({ error: "Lỗi lấy top sản phẩm bán chạy", details: err });
  }
};

// Đơn hàng gần đây
exports.getRecentOrders = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const recentOrders = await Order.find()
      .populate("customerId", "name email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ recentOrders });
  } catch (err) {
    console.error("Lỗi lấy đơn hàng gần đây:", err);
    res.status(500).json({ error: "Lỗi lấy đơn hàng gần đây", details: err });
  }
};

// Người dùng mới đăng ký
exports.getNewUsers = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    const newUsers = await User.find({
      createdAt: { $gte: startDate },
      isAdmin: { $ne: true }, // Chỉ lấy user thường, không bao gồm admin
    }).sort({ createdAt: -1 });

    // Lấy dữ liệu thực tế
    const userData = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          isAdmin: { $ne: true }, // Chỉ đếm user thường, không bao gồm admin
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Tạo mảng đầy đủ cho tất cả các ngày trong khoảng thời gian
    const usersByDay = [];
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (let i = parseInt(days) - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(currentDate.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();

      // Tìm dữ liệu tương ứng với ngày này
      const dayData = userData.find(
        (item) =>
          item._id.year === year &&
          item._id.month === month &&
          item._id.day === day
      );

      usersByDay.push({
        _id: { year, month, day },
        count: dayData?.count || 0,
      });
    }

    res.json({ newUsers, usersByDay });
  } catch (err) {
    console.error("Lỗi lấy người dùng mới:", err);
    res.status(500).json({ error: "Lỗi lấy người dùng mới", details: err });
  }
};
