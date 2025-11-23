// Tra cứu bảo hành theo token user
exports.lookupWarranty = async (req, res) => {
  try {
    const userId = req.user.id;
    // Chỉ lấy các đơn đã giao (status = 3)
    const orders = await Order.find({ customerId: userId, status: 3 }).populate(
      "items.productId"
    );
    const result = [];
    for (const order of orders) {
      for (const item of order.items) {
        const purchaseDate = order.createdAt;
        const warrantyMonths = item.warrantyMonths || 12;
        const expiredDate = new Date(purchaseDate);
        expiredDate.setMonth(expiredDate.getMonth() + warrantyMonths);
        result.push({
          orderId: order._id,
          productName: item.productId?.name || "",
          productId: item.productId?._id || item.productId,
          purchaseDate,
          warrantyMonths,
          expiredDate,
          status: new Date() <= expiredDate ? "Còn hạn" : "Hết hạn",
        });
      }
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Lỗi tra cứu bảo hành",
      details: err.message,
    });
  }
};
// Lấy tất cả đơn hàng (admin)
exports.getAllOrders = async (req, res) => {
  try {
    const { isInstallment } = req.query;

    let filter = {};
    // Lọc đơn trả góp nếu có query param
    if (isInstallment === "true") {
      filter["installment.isInstallment"] = true;
    } else if (isInstallment === "false") {
      filter["installment.isInstallment"] = { $ne: true };
    }

    const orders = await Order.find(filter).populate(
      "customerId",
      "name email"
    );
    res.json({ orders });
  } catch (err) {
    console.error("Lỗi lấy tất cả đơn hàng:", err);
    res.status(500).json({ error: "Lỗi lấy tất cả đơn hàng", details: err });
  }
};

// Xóa đơn hàng (admin)
exports.deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findByIdAndDelete(orderId);
    if (!order) {
      return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    }
    res.json({ message: "Xóa đơn hàng thành công", order });
  } catch (err) {
    console.error("Lỗi xóa đơn hàng:", err);
    res.status(500).json({ error: "Lỗi xóa đơn hàng", details: err });
  }
};

// Cập nhật trạng thái đơn hàng (admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id || req.body.orderId;
    const status = req.body.status;
    if (!orderId || typeof status !== "number") {
      console.error("Thiếu orderId hoặc status", { orderId, status });
      return res.status(400).json({ error: "Thiếu orderId hoặc status" });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      console.error("Không tìm thấy đơn hàng với orderId:", orderId);
      return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    }
    order.status = status;
    await order.save();
    res.json({ message: "Cập nhật trạng thái thành công", order });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái đơn hàng:", err);
    res
      .status(400)
      .json({ error: "Lỗi cập nhật trạng thái đơn hàng", details: err });
  }
};
// src/controllers/orderController.js
const Order = require("../models/Order");
const Product = require("../models/Product");
// Cập nhật trạng thái đơn hàng
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    if (!orderId || typeof status !== "number") {
      console.error("Thiếu orderId hoặc status", { orderId, status });
      return res.status(400).json({ error: "Thiếu orderId hoặc status" });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      console.error("Không tìm thấy đơn hàng với orderId:", orderId);
      return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    }
    order.status = status;
    await order.save();
    res.json({ message: "Cập nhật trạng thái thành công", order });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái đơn hàng:", err);
    res
      .status(400)
      .json({ error: "Lỗi cập nhật trạng thái đơn hàng", details: err });
  }
};

// Thêm đơn hàng mới
exports.createOrder = async (req, res) => {
  try {
    console.log(
      "[ORDER] Thông tin nhận được từ FE:",
      JSON.stringify(req.body, null, 2)
    );
    const customerId = req.user.id;
    const {
      items,
      address,
      phone,
      note,
      status,
      paymentMethod,
      total: totalFromFE,
      installment, // Thông tin trả góp (nếu có)
    } = req.body;
    // items chỉ gồm productId và quantity
    // Lấy giá từ Product cho từng item
    const populatedItems = [];
    let total = 0;
    // Đã require Product ở đầu file, không cần lặp lại
    for (const item of items) {
      let price = 0;
      let warrantyMonths = 12;
      let product = null;
      if (item.variant && typeof item.variant.price === "number") {
        price = item.variant.price;
      } else if (typeof item.price === "number") {
        price = item.price;
      } else {
        product = await Product.findById(item.productId);
        if (!product) {
          return res.status(400).json({
            error: `Không tìm thấy sản phẩm với id ${item.productId}`,
          });
        }
        price = product.price;
      }
      // Lấy thời hạn bảo hành từ Product (nếu có)
      if (!product) product = await Product.findById(item.productId);
      if (product && product.specs && product.specs.warrantyMonths) {
        warrantyMonths = product.specs.warrantyMonths;
      }
      populatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price,
        ram: item.ram || "",
        storage: item.storage || "",
        variant: item.variant || {},
        warrantyMonths,
      });
      total += price * (item.quantity || 1);
    }

    // Xử lý thông tin trả góp (nếu có)
    let installmentData = null;
    if (installment && installment.isInstallment) {
      const principal = total - (installment.upfront || 0);
      let monthlyPayment, totalPayment;

      if (installment.type === "creditCard") {
        // Trả góp qua thẻ tín dụng: không lãi suất
        monthlyPayment = principal / (installment.months || 12);
        totalPayment =
          monthlyPayment * (installment.months || 12) +
          (installment.upfront || 0);
      } else if (installment.type === "financeCompany") {
        // Trả góp qua công ty tài chính: có lãi suất
        const monthlyRate =
          installment.interestRate > 0 ? installment.interestRate / 100 : 0.02;
        monthlyPayment =
          (principal * monthlyRate) /
          (1 - Math.pow(1 + monthlyRate, -(installment.months || 12)));
        totalPayment =
          monthlyPayment * (installment.months || 12) +
          (installment.upfront || 0);
      }

      installmentData = {
        isInstallment: true,
        type: installment.type,
        upfront: installment.upfront || 0,
        months: installment.months || 12,
        interestRate: installment.interestRate || 0,
        monthlyPayment: Math.round(monthlyPayment),
        totalPayment: Math.round(totalPayment),
        transactionId: installment.transactionId || "",
        financeStatus: installment.financeStatus || "pending",
        customerInfo: installment.customerInfo || {},
      };
    }

    const order = new Order({
      customerId,
      items: populatedItems,
      total,
      address,
      phone,
      note,
      status: 0,
      paymentMethod: paymentMethod || "cod",
      installment: installmentData,
    });
    await order.save();

    // Trừ stock sản phẩm khi tạo đơn
    for (const item of populatedItems) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -Math.abs(item.quantity || 1) } },
        { new: true }
      );
    }

    // Gửi mail xác nhận đơn hàng cho khách
    try {
      const sendMail = require("../utils/sendMail");
      let email = req.user.email;
      if (!email) {
        const user = await require("../models/User").findById(customerId);
        email = user?.email;
      }
      if (email) {
        await sendMail({
          to: email,
          subject: "Xác nhận đơn hàng",
          text: `Đơn hàng của bạn đã được tạo thành công. Mã đơn hàng: ${order._id}. Tổng tiền: ${total} VND.`,
          html: `<h1>Đơn hàng của bạn đã được tạo thành công</h1><p>Mã đơn hàng: <b>${
            order._id
          }</b></p><p>Tổng tiền: <b>${total.toLocaleString()} VND</b></p>`,
        });
      }
    } catch (mailErr) {
      console.error("Lỗi gửi mail xác nhận đơn hàng:", mailErr);
    }

    res.status(201).json(order);
  } catch (err) {
    console.error("Lỗi khi tạo đơn hàng:", err);
    res.status(400).json({ error: "Lỗi khi tạo đơn hàng" });
  }
};

// Lấy danh sách đơn hàng của user
exports.getOrdersByCustomer = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { isInstallment } = req.query;

    let filter = { customerId };
    // Lọc đơn trả góp nếu có query param
    if (isInstallment === "true") {
      filter["installment.isInstallment"] = true;
    } else if (isInstallment === "false") {
      filter["installment.isInstallment"] = { $ne: true };
    }

    const orders = await Order.find(filter)
      .populate("items.productId")
      .sort({ createdAt: -1 }); // Sắp xếp mới nhất trước

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách đơn hàng" });
  }
};
// Cập nhật trạng thái trả góp (admin)
exports.updateInstallmentStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { financeStatus } = req.body;

    if (!["pending", "approved", "rejected"].includes(financeStatus)) {
      return res.status(400).json({
        error:
          "Trạng thái không hợp lệ. Phải là: pending, approved, hoặc rejected",
      });
    }

    const order = await Order.findById(orderId).populate(
      "customerId",
      "name email"
    );
    if (!order) {
      return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    }

    if (!order.installment || !order.installment.isInstallment) {
      return res
        .status(400)
        .json({ error: "Đơn hàng này không phải đơn trả góp" });
    }

    // Cập nhật trạng thái trả góp
    order.installment.financeStatus = financeStatus;

    // Nếu duyệt hồ sơ, chuyển đơn hàng sang trạng thái đã xác nhận
    if (financeStatus === "approved") {
      order.status = 1; // Đã xác nhận
    }

    // Nếu từ chối, hủy đơn hàng
    if (financeStatus === "rejected") {
      order.status = 4; // Đã hủy
      // Cộng lại stock cho từng sản phẩm
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: Math.abs(item.quantity || 1) } },
          { new: true }
        );
      }
    }

    await order.save();

    // Gửi email thông báo cho khách hàng
    try {
      const sendMail = require("../utils/sendMail");
      const email = order.customerId?.email;
      if (email) {
        let subject, text, html;
        if (financeStatus === "approved") {
          subject = "Hồ sơ trả góp đã được duyệt";
          text = `Chúc mừng! Hồ sơ trả góp của bạn đã được công ty tài chính phê duyệt. Mã đơn hàng: ${order._id}`;
          html = `<h1>✅ Hồ sơ trả góp đã được duyệt</h1>
                  <p>Chúc mừng! Hồ sơ trả góp của bạn đã được công ty tài chính phê duyệt.</p>
                  <p>Mã đơn hàng: <b>${order._id}</b></p>
                  <p>Chúng tôi sẽ tiến hành giao hàng trong thời gian sớm nhất.</p>`;
        } else if (financeStatus === "rejected") {
          subject = "Hồ sơ trả góp bị từ chối";
          text = `Rất tiếc, hồ sơ trả góp của bạn chưa được công ty tài chính phê duyệt. Mã đơn hàng: ${order._id}`;
          html = `<h1>❌ Hồ sơ trả góp chưa được duyệt</h1>
                  <p>Rất tiếc, hồ sơ trả góp của bạn chưa được công ty tài chính phê duyệt.</p>
                  <p>Mã đơn hàng: <b>${order._id}</b></p>
                  <p>Vui lòng liên hệ với chúng tôi để được hỗ trợ hoặc chọn hình thức thanh toán khác.</p>`;
        }
        if (subject) {
          await sendMail({ to: email, subject, text, html });
        }
      }
    } catch (mailErr) {
      console.error("Lỗi gửi mail thông báo trạng thái trả góp:", mailErr);
    }

    res.json({
      message: "Cập nhật trạng thái trả góp thành công",
      order,
    });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái trả góp:", err);
    res.status(500).json({
      error: "Lỗi cập nhật trạng thái trả góp",
      details: err.message,
    });
  }
};

// Lấy danh sách đơn hàng trả góp (admin)
exports.getInstallmentOrders = async (req, res) => {
  try {
    const { financeStatus } = req.query;

    const filter = { "installment.isInstallment": true };
    if (financeStatus) {
      filter["installment.financeStatus"] = financeStatus;
    }

    const orders = await Order.find(filter)
      .populate("customerId", "name email phone")
      .populate("items.productId", "name images")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    console.error("Lỗi lấy danh sách đơn hàng trả góp:", err);
    res.status(500).json({
      error: "Lỗi lấy danh sách đơn hàng trả góp",
      details: err.message,
    });
  }
};

// Xóa đơn hàng
exports.deleteOrder = async (req, res) => {
  try {
    // Tìm đơn hàng trước khi xóa để cộng lại stock
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Không tìm thấy đơn hàng để xóa" });
    }
    // Cộng lại stock cho từng sản phẩm
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: Math.abs(item.quantity || 1) } },
        { new: true }
      );
    }
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Xóa đơn hàng thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi xóa đơn hàng" });
  }
};
