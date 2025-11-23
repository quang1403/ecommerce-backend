const Product = require("../models/Product");

/**
 * POST /api/chat/installment
 * Tính toán trả góp cho sản phẩm
 * Body: { productId, upfront, months, interestRate }
 */
exports.calculateInstallment = async (req, res) => {
  try {
    const {
      productId,
      upfront = 0,
      months = 12,
      interestRate = 0,
      type = "creditCard",
    } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, error: "Thiếu productId" });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Không tìm thấy sản phẩm" });
    }
    const price = product.price;
    const principal = price - upfront;
    let monthlyPayment,
      totalPayment,
      monthlyRate,
      detail,
      extraInfo = {};

    if (type === "creditCard") {
      // Trả góp qua thẻ tín dụng: không lãi suất
      monthlyPayment = principal / months;
      totalPayment = monthlyPayment * months + upfront;
      detail = `Trả góp qua thẻ tín dụng: Trả trước ${upfront.toLocaleString()}đ, trả góp ${months} tháng, mỗi tháng khoảng ${Math.round(
        monthlyPayment
      ).toLocaleString()}đ. Tổng phải trả: ${Math.round(
        totalPayment
      ).toLocaleString()}đ.`;
      extraInfo = {
        required: "Thẻ tín dụng hợp lệ, đủ hạn mức",
        note: "Không cần xét duyệt hồ sơ, xác thực qua OTP ngân hàng khi thanh toán.",
      };
    } else if (type === "financeCompany") {
      // Trả góp qua công ty tài chính: có lãi suất
      monthlyRate = interestRate > 0 ? interestRate / 100 : 0.02; // lãi suất truyền vào là %/tháng, nếu chưa truyền thì mặc định 2%/tháng
      monthlyPayment =
        (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
      totalPayment = monthlyPayment * months + upfront;
      detail = `Trả góp qua công ty tài chính: Trả trước ${upfront.toLocaleString()}đ, trả góp ${months} tháng, lãi suất ${(
        monthlyRate * 100
      ).toFixed(2)}%/tháng, mỗi tháng khoảng ${Math.round(
        monthlyPayment
      ).toLocaleString()}đ. Tổng phải trả: ${Math.round(
        totalPayment
      ).toLocaleString()}đ.`;
      extraInfo = {
        required: "CMND/CCCD, ảnh chân dung, giấy tờ chứng minh thu nhập",
        note: "Công ty tài chính sẽ xét duyệt hồ sơ, xác thực qua gọi điện hoặc gặp trực tiếp.",
      };
    } else {
      // Mặc định: không lãi suất
      monthlyPayment = principal / months;
      totalPayment = monthlyPayment * months + upfront;
      detail = `Trả góp: Trả trước ${upfront.toLocaleString()}đ, trả góp ${months} tháng, mỗi tháng khoảng ${Math.round(
        monthlyPayment
      ).toLocaleString()}đ. Tổng phải trả: ${Math.round(
        totalPayment
      ).toLocaleString()}đ.`;
    }

    res.json({
      success: true,
      product: { id: product._id, name: product.name, price },
      upfront,
      months,
      interestRate:
        type === "financeCompany" ? (monthlyRate * 100).toFixed(2) : 0, // trả về %/tháng
      monthlyPayment: Math.round(monthlyPayment),
      totalPayment: Math.round(totalPayment),
      type,
      detail,
      extraInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Lỗi tính trả góp",
      details: error.message,
    });
  }
};
