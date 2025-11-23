const Phone = require("../models/Phone");

// Lấy danh sách điện thoại
exports.getAllPhones = async (req, res) => {
  try {
    const phones = await Phone.find();
    res.json(phones);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách điện thoại" });
  }
};

// Thêm điện thoại mới
exports.createPhone = async (req, res) => {
  try {
    const newPhone = new Phone(req.body);
    await newPhone.save();
    res.status(201).json(newPhone);
  } catch (err) {
    res.status(400).json({ error: "Thêm điện thoại thất bại" });
  }
};
exports.getPhoneById = async (req, res) => {
  try {
    const phone = await Phone.findById(req.params.id);
    if (!phone) return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
    res.json(phone);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy sản phẩm" });
  }
};
exports.updatePhone = async (req, res) => {
  try {
    const phone = await Phone.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!phone) return res.status(404).json({ error: "Không tìm thấy sản phẩm để cập nhật" });
    res.json(phone);
  } catch (err) {
    res.status(400).json({ error: "Lỗi khi cập nhật sản phẩm" });
  }
};
exports.deletePhone = async (req, res) => {
  try {
    const phone = await Phone.findByIdAndDelete(req.params.id);
    if (!phone) return res.status(404).json({ error: "Không tìm thấy sản phẩm để xóa" });
    res.json({ message: "Xóa sản phẩm thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi xóa sản phẩm" });
  }
};
