// Lấy danh sách địa chỉ của user
exports.getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("addresses");
    if (!user) return res.status(404).json({ error: "Không tìm thấy user" });
    res.json({ success: true, addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy địa chỉ", details: err.message });
  }
};
// Thêm địa chỉ mới cho user
exports.addAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { label, address, phone, isDefault } = req.body;
    if (!address) return res.status(400).json({ error: "Thiếu địa chỉ" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Không tìm thấy user" });
    if (isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }
    user.addresses.push({ label, address, phone, isDefault });
    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ error: "Lỗi thêm địa chỉ", details: err.message });
  }
};

// Sửa địa chỉ (theo index hoặc _id của address)
exports.updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;
    const { label, address, phone, isDefault } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Không tìm thấy user" });
    const addr = user.addresses.id(addressId);
    if (!addr) return res.status(404).json({ error: "Không tìm thấy địa chỉ" });
    if (label !== undefined) addr.label = label;
    if (address !== undefined) addr.address = address;
    if (phone !== undefined) addr.phone = phone;
    if (isDefault) {
      user.addresses.forEach((a) => (a.isDefault = false));
      addr.isDefault = true;
    }
    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Lỗi cập nhật địa chỉ", details: err.message });
  }
};

// Xóa địa chỉ
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Không tìm thấy user" });
    user.addresses = user.addresses.filter(
      (addr) => addr._id.toString() !== addressId
    );
    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xóa địa chỉ", details: err.message });
  }
};
// Admin tạo user mới
exports.adminCreateUser = async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json({ message: "Admin đã tạo user thành công", user });
  } catch (error) {
    res.status(500).json({ message: "Lỗi admin tạo user", error });
  }
};
// Khóa/mở tài khoản user (admin)
exports.toggleActiveUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { isActive } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select("_id fullName email isAdmin isActive createdAt updatedAt");
    if (!updatedUser)
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    res.json({
      message: isActive ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản",
      user: updatedUser,
    });
  } catch (err) {
    res.status(400).json({ error: "Lỗi khi cập nhật trạng thái tài khoản" });
  }
};
// Xoá người dùng
exports.deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser)
      return res
        .status(404)
        .json({ error: "Không tìm thấy người dùng để xóa" });
    res.json({ message: "Xóa người dùng thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi xóa người dùng" });
  }
};
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const sendMail = require("../utils/sendMail");
const crypto = require("crypto");

// Đổi mật khẩu
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id; // lấy từ token
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ error: "Không tìm thấy người dùng" });

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch)
      return res.status(400).json({ error: "Mật khẩu cũ không đúng" });

    user.password = newPassword;
    await user.save();
    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    res.status(400).json({ error: "Lỗi khi đổi mật khẩu" });
  }
};
// Lấy thông tin user theo token (profile)
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );
    if (!user) return res.status(404).json({ error: "Không tìm thấy user" });
    res.json(user);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Lỗi lấy thông tin user", details: err.message });
  }
};
// Logout
exports.logout = async (req, res) => {
  // FE chỉ cần xóa token ở client, backend xác nhận logout
  res.json({ message: "Đăng xuất thành công" });
};

// Đăng ký
exports.register = async (req, res) => {
  try {
    // Validate email
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(req.body.email)) {
      return res.status(400).json({ error: "Email không hợp lệ" });
    }
    // Validate phone nếu có
    if (req.body.phone) {
      const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
      if (!phoneRegex.test(req.body.phone)) {
        return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
      }
    }
    const user = new User(req.body);
    await user.save();

    // thử gửi mail, nhưng không để fail ảnh hưởng response
    try {
      await sendMail({
        to: user.email,
        subject: "🎉 Chào mừng bạn đến với Phone Store",
        text: `Xin chào ${user.fullName}, cảm ơn bạn đã đăng ký!`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4;">
            <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #4CAF50;">Xin chào ${user.fullName} 👋</h2>
              <p>Cảm ơn bạn đã đăng ký tài khoản tại <b>Phone Store</b>.</p>
              <p>Hãy bắt đầu trải nghiệm mua sắm ngay hôm nay 🚀</p>
              <a href="http://localhost:3000" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #4CAF50; color: #fff; text-decoration: none; border-radius: 5px;">
                Truy cập Phone Store
              </a>
              <hr style="margin: 30px 0;"/>
              <p style="font-size: 12px; color: #888;">Đây là email tự động, vui lòng không trả lời.</p>
            </div>
          </div>
        `,
      });
    } catch (mailError) {
      console.error("Lỗi gửi email:", mailError.message);
    }

    // Trả về thông tin cần thiết
    res.status(201).json({
      message: "Đăng ký thành công",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi đăng ký", error });
  }
};

// Đăng nhập
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Validate email
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Email không hợp lệ" });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Email không tồn tại" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: "Sai mật khẩu" });

    const token = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      "secret_key",
      { expiresIn: "1d" }
    );

    res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đăng nhập" });
  }
};

// Lấy danh sách người dùng
exports.getAllUsers = async (req, res) => {
  try {
    // Trả về tất cả trường trừ password và token
    const users = await User.find().select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách người dùng" });
  }
};

// Lấy thông tin người dùng theo ID
exports.getUserById = async (req, res) => {
  try {
    // Trả về đầy đủ thông tin user, ẩn password và token
    const user = await User.findById(req.params.id).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );
    if (!user)
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy người dùng" });
  }
};

// Cập nhật người dùng
exports.updateUser = async (req, res) => {
  try {
    // Chỉ cho phép user tự cập nhật hoặc admin
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;
    if (userId !== req.params.id && !isAdmin) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền cập nhật thông tin user này" });
    }
    const updateData = req.body;
    if (updateData.password) delete updateData.password; // Không cho sửa password ở đây
    // Validate email nếu có
    if (updateData.email) {
      const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (!emailRegex.test(updateData.email)) {
        return res.status(400).json({ error: "Email không hợp lệ" });
      }
    }
    // Validate phone nếu có
    if (updateData.phone) {
      const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
      if (!phoneRegex.test(updateData.phone)) {
        return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
      }
    }
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select("_id fullName email isAdmin createdAt updatedAt");
    if (!updatedUser)
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    res.json(updatedUser);
  } catch (err) {
    console.error("Lỗi khi cập nhật người dùng:", err);
    res
      .status(400)
      .json({ error: "Lỗi khi cập nhật người dùng", details: err });
  }
};

// Gửi email quên mật khẩu
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email không tồn tại" });
    }
    // Tạo token reset
    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600 * 1000; // 1h
    await user.save();
    // Gửi email
    const resetLink = `http://localhost:3000/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: "Đặt lại mật khẩu",
      text: `Nhấn vào link sau để đặt lại mật khẩu: ${resetLink}`,
      html: `<p>Nhấn vào link sau để đặt lại mật khẩu:</p><a href='${resetLink}'>${resetLink}</a>`,
    });
    res.json({
      success: true,
      message: "Đã gửi email đặt lại mật khẩu",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Đặt lại mật khẩu bằng token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Token không hợp lệ hoặc đã hết hạn",
      });
    }
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ success: true, message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
