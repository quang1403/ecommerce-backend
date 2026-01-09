// Template xác nhận đơn hàng
exports.orderConfirmationTemplate = (orderData) => {
  const {
    orderId,
    customerName,
    items,
    total,
    address,
    phone,
    paymentMethod,
    orderDate,
  } = orderData;

  const paymentMethodText = {
    cod: "Thanh toán khi nhận hàng (COD)",
    online: "Thanh toán online",
    creditCard: "Thẻ tín dụng",
    installment: "Trả góp",
  };

  const itemsHtml = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 15px; border-bottom: 1px solid #eee;">
        <strong>${item.name}</strong><br/>
        ${
          item.color
            ? `<span style="color: #666;">Màu: ${item.color}</span><br/>`
            : ""
        }
        ${
          item.memory
            ? `<span style="color: #666;">Bộ nhớ: ${item.memory}</span><br/>`
            : ""
        }
        ${
          item.ram
            ? `<span style="color: #666;">RAM: ${item.ram}</span><br/>`
            : ""
        }
        ${
          item.storage
            ? `<span style="color: #666;">Dung lượng: ${item.storage}</span>`
            : ""
        }
      </td>
      <td style="padding: 15px; border-bottom: 1px solid #eee; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 15px; border-bottom: 1px solid #eee; text-align: right;">
        ${item.price.toLocaleString("vi-VN")}đ
      </td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Xác nhận đơn hàng</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                    📱 Phone Store
                  </h1>
                  <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">
                    Cảm ơn bạn đã đặt hàng!
                  </p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 30px;">
                  
                  <!-- Greeting -->
                  <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">
                    Xin chào ${customerName}! 👋
                  </h2>
                  
                  <p style="margin: 0 0 20px 0; color: #666; font-size: 16px; line-height: 1.6;">
                    Đơn hàng <strong style="color: #667eea;">#${orderId}</strong> của bạn đã được xác nhận thành công. 
                    Chúng tôi sẽ xử lý và giao hàng trong thời gian sớm nhất.
                  </p>

                  <!-- Order Info Box -->
                  <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
                    <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">
                      📦 Thông tin đơn hàng
                    </h3>
                    <p style="margin: 5px 0; color: #666;">
                      <strong>Mã đơn:</strong> ${orderId}
                    </p>
                    <p style="margin: 5px 0; color: #666;">
                      <strong>Ngày đặt:</strong> ${orderDate}
                    </p>
                    <p style="margin: 5px 0; color: #666;">
                      <strong>Địa chỉ:</strong> ${address}
                    </p>
                    <p style="margin: 5px 0; color: #666;">
                      <strong>Số điện thoại:</strong> ${phone}
                    </p>
                    <p style="margin: 5px 0; color: #666;">
                      <strong>Phương thức thanh toán:</strong> ${
                        paymentMethodText[paymentMethod] || paymentMethod
                      }
                    </p>
                  </div>

                  <!-- Items Table -->
                  <h3 style="margin: 30px 0 15px 0; color: #333; font-size: 18px;">
                    🛍️ Sản phẩm đã đặt
                  </h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #eee; border-radius: 4px; overflow: hidden;">
                    <thead>
                      <tr style="background-color: #f8f9fa;">
                        <th style="padding: 15px; text-align: left; color: #333; font-weight: bold;">Sản phẩm</th>
                        <th style="padding: 15px; text-align: center; color: #333; font-weight: bold;">SL</th>
                        <th style="padding: 15px; text-align: right; color: #333; font-weight: bold;">Giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                      <tr>
                        <td colspan="2" style="padding: 20px; text-align: right; font-size: 18px; font-weight: bold; color: #333;">
                          Tổng cộng:
                        </td>
                        <td style="padding: 20px; text-align: right; font-size: 20px; font-weight: bold; color: #667eea;">
                          ${total.toLocaleString("vi-VN")}đ
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Call to Action -->
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${
                      process.env.FRONTEND_URL || "http://localhost:3000"
                    }/orders/${orderId}" 
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-weight: bold; font-size: 16px;">
                      Xem chi tiết đơn hàng
                    </a>
                  </div>

                  <!-- Support Info -->
                  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #856404; font-size: 14px;">
                      <strong>💡 Lưu ý:</strong> Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua hotline 
                      <strong>1900-xxxx</strong> hoặc email <strong>support@phonestore.com</strong>
                    </p>
                  </div>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                  <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                    Cảm ơn bạn đã tin tưởng Phone Store! 🙏
                  </p>
                  <p style="margin: 0; color: #999; font-size: 12px;">
                    Email này được gửi tự động, vui lòng không trả lời email này.
                  </p>
                  <div style="margin-top: 15px;">
                    <a href="#" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 12px;">Facebook</a>
                    <a href="#" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 12px;">Instagram</a>
                    <a href="#" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 12px;">Website</a>
                  </div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Template reset password
exports.resetPasswordTemplate = (resetData) => {
  const { customerName, resetLink, expiryTime } = resetData;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Đặt lại mật khẩu</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                    🔐 Đặt lại mật khẩu
                  </h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">
                    Xin chào ${customerName},
                  </h2>
                  
                  <p style="margin: 0 0 20px 0; color: #666; font-size: 16px; line-height: 1.6;">
                    Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. 
                    Nhấn vào nút bên dưới để thiết lập mật khẩu mới:
                  </p>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" 
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-weight: bold; font-size: 16px;">
                      Đặt lại mật khẩu
                    </a>
                  </div>

                  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">
                      <strong>⏰ Lưu ý:</strong> Link này sẽ hết hạn sau <strong>${
                        expiryTime || "15 phút"
                      }</strong>.
                    </p>
                    <p style="margin: 0; color: #856404; font-size: 14px;">
                      Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
                    </p>
                  </div>

                  <p style="margin: 20px 0 0 0; color: #999; font-size: 14px;">
                    Hoặc copy link sau vào trình duyệt:<br/>
                    <a href="${resetLink}" style="color: #667eea; word-break: break-all;">${resetLink}</a>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                  <p style="margin: 0; color: #999; font-size: 12px;">
                    © 2025 Phone Store. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Template chào mừng khách hàng mới
exports.welcomeTemplate = (customerData) => {
  const { customerName } = customerData;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chào mừng đến Phone Store</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">
                    🎉 Chào mừng!
                  </h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px; text-align: center;">
                  <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">
                    Xin chào ${customerName}! 👋
                  </h2>
                  
                  <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; line-height: 1.6;">
                    Cảm ơn bạn đã đăng ký tài khoản tại <strong style="color: #667eea;">Phone Store</strong>.<br/>
                    Chúng tôi rất vui được đồng hành cùng bạn!
                  </p>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${
                      process.env.FRONTEND_URL || "http://localhost:3000"
                    }" 
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-weight: bold; font-size: 16px;">
                      Khám phá ngay
                    </a>
                  </div>

                  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin: 30px 0; text-align: left;">
                    <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">
                      🎁 Ưu đãi dành cho bạn:
                    </h3>
                    <ul style="margin: 0; padding-left: 20px; color: #666; line-height: 1.8;">
                      <li>Miễn phí vận chuyển cho đơn hàng đầu tiên</li>
                      <li>Giảm 10% cho lần mua tiếp theo</li>
                      <li>Tích điểm mỗi lần mua hàng</li>
                      <li>Bảo hành chính hãng 12 tháng</li>
                    </ul>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                  <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                    Cần hỗ trợ? Liên hệ hotline: <strong>1900-1508</strong>
                  </p>
                  <p style="margin: 0; color: #999; font-size: 12px;">
                    © 2025 Phone Store. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Template trả góp được duyệt
exports.installmentApprovedTemplate = (data) => {
  const { customerName, orderId, monthlyPayment, months } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hồ sơ trả góp đã được duyệt</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #52c234 0%, #4caf50 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">
                    ✅ Chúc mừng!
                  </h1>
                  <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 18px;">
                    Hồ sơ trả góp đã được phê duyệt
                  </p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">
                    Xin chào ${customerName}! 👋
                  </h2>
                  
                  <p style="margin: 0 0 20px 0; color: #666; font-size: 16px; line-height: 1.6;">
                    Chúng tôi vui mừng thông báo rằng hồ sơ trả góp của bạn đã được 
                    <strong style="color: #4caf50;">công ty tài chính phê duyệt</strong>! 🎉
                  </p>

                  <!-- Order Info Box -->
                  <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 4px;">
                    <h3 style="margin: 0 0 15px 0; color: #2e7d32; font-size: 18px;">
                      📋 Thông tin trả góp
                    </h3>
                    <p style="margin: 5px 0; color: #333;">
                      <strong>Mã đơn hàng:</strong> ${orderId}
                    </p>
                    <p style="margin: 5px 0; color: #333;">
                      <strong>Số tiền trả hàng tháng:</strong> ${monthlyPayment.toLocaleString(
                        "vi-VN"
                      )}đ
                    </p>
                    <p style="margin: 5px 0; color: #333;">
                      <strong>Thời gian:</strong> ${months} tháng
                    </p>
                  </div>

                  <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #e65100; font-size: 14px;">
                      <strong>📦 Tiếp theo:</strong> Chúng tôi sẽ tiến hành xử lý và giao hàng trong thời gian sớm nhất. 
                      Vui lòng để ý điện thoại để nhận hàng.
                    </p>
                  </div>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${
                      process.env.FRONTEND_URL || "http://localhost:3000"
                    }/orders/${orderId}" 
                       style="display: inline-block; background: linear-gradient(135deg, #52c234 0%, #4caf50 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-weight: bold; font-size: 16px;">
                      Xem đơn hàng
                    </a>
                  </div>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                  <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                    Cảm ơn bạn đã tin tưởng Phone Store! 🙏
                  </p>
                  <p style="margin: 0; color: #999; font-size: 12px;">
                    © 2025 Phone Store. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Template trả góp bị từ chối
exports.installmentRejectedTemplate = (data) => {
  const { customerName, orderId } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hồ sơ trả góp chưa được duyệt</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #ef5350 0%, #e53935 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                    📋 Thông báo về hồ sơ trả góp
                  </h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">
                    Xin chào ${customerName},
                  </h2>
                  
                  <p style="margin: 0 0 20px 0; color: #666; font-size: 16px; line-height: 1.6;">
                    Rất tiếc, hồ sơ trả góp của bạn cho đơn hàng <strong>#${orderId}</strong> 
                    chưa được công ty tài chính phê duyệt trong lần này.
                  </p>

                  <!-- Reason Box -->
                  <div style="background-color: #ffebee; border-left: 4px solid #ef5350; padding: 20px; margin: 20px 0; border-radius: 4px;">
                    <h3 style="margin: 0 0 15px 0; color: #c62828; font-size: 18px;">
                      ℹ️ Một số lý do thường gặp:
                    </h3>
                    <ul style="margin: 0; padding-left: 20px; color: #666; line-height: 1.8;">
                      <li>Thông tin hồ sơ chưa đầy đủ</li>
                      <li>Điều kiện tài chính chưa đáp ứng yêu cầu</li>
                      <li>Chứng từ không hợp lệ</li>
                    </ul>
                  </div>

                  <!-- Next Steps -->
                  <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; border-radius: 4px;">
                    <h3 style="margin: 0 0 15px 0; color: #1565c0; font-size: 18px;">
                      💡 Bạn có thể:
                    </h3>
                    <ul style="margin: 0; padding-left: 20px; color: #666; line-height: 1.8;">
                      <li>Nộp lại hồ sơ với thông tin đầy đủ hơn</li>
                      <li>Chọn hình thức thanh toán khác (COD, chuyển khoản)</li>
                      <li>Liên hệ hotline <strong>1900-xxxx</strong> để được tư vấn</li>
                    </ul>
                  </div>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${
                      process.env.FRONTEND_URL || "http://localhost:3000"
                    }/contact" 
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-weight: bold; font-size: 16px;">
                      Liên hệ hỗ trợ
                    </a>
                  </div>

                  <p style="margin: 20px 0 0 0; color: #999; font-size: 14px; text-align: center;">
                    Đơn hàng <strong>#${orderId}</strong> đã bị hủy. Bạn có thể đặt lại đơn hàng mới với hình thức thanh toán phù hợp.
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                  <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                    Chúng tôi luôn sẵn sàng hỗ trợ bạn! 💪
                  </p>
                  <p style="margin: 0; color: #999; font-size: 12px;">
                    © 2025 Phone Store. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};
