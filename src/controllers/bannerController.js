// src/controllers/bannerController.js

const Banner = require("../models/Banner");

// GET /api/banners - Lấy tất cả banners
exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi khi lấy danh sách banner", message: error.message });
  }
};

// GET /api/banners/:id - Lấy một banner theo ID
exports.getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ error: "Không tìm thấy banner" });
    }
    res.json(banner);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi khi lấy banner", message: error.message });
  }
};

// POST /api/banners - Tạo banner mới (Admin only)
exports.createBanner = async (req, res) => {
  try {
    const { title, image, link, position } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Thiếu thông tin image" });
    }

    const banner = new Banner({
      title,
      image,
      link,
      position,
    });

    await banner.save();
    res.status(201).json({ message: "Tạo banner thành công", banner });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi khi tạo banner", message: error.message });
  }
};

// PUT /api/banners/:id - Cập nhật banner (Admin only)
exports.updateBanner = async (req, res) => {
  try {
    const { title, image, link, position } = req.body;

    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { title, image, link, position },
      { new: true, runValidators: true }
    );

    if (!banner) {
      return res.status(404).json({ error: "Không tìm thấy banner" });
    }

    res.json({ message: "Cập nhật banner thành công", banner });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi khi cập nhật banner", message: error.message });
  }
};

// DELETE /api/banners/:id - Xóa banner (Admin only)
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);

    if (!banner) {
      return res.status(404).json({ error: "Không tìm thấy banner" });
    }

    res.json({ message: "Xóa banner thành công" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi khi xóa banner", message: error.message });
  }
};
