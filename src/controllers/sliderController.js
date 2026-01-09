// src/controllers/sliderController.js

const Slider = require("../models/Slider");

// GET /api/sliders - Lấy tất cả sliders
exports.getSliders = async (req, res) => {
  try {
    const sliders = await Slider.find().sort({ createdAt: -1 });
    res.json(sliders);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi khi lấy danh sách slider", message: error.message });
  }
};

// GET /api/sliders/:id - Lấy một slider theo ID
exports.getSliderById = async (req, res) => {
  try {
    const slider = await Slider.findById(req.params.id);
    if (!slider) {
      return res.status(404).json({ error: "Không tìm thấy slider" });
    }
    res.json(slider);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi khi lấy slider", message: error.message });
  }
};

// POST /api/sliders - Tạo slider mới (Admin only)
exports.createSlider = async (req, res) => {
  try {
    const { title, image, link } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Thiếu thông tin image" });
    }

    const slider = new Slider({
      title,
      image,
      link,
    });

    await slider.save();
    res.status(201).json({ message: "Tạo slider thành công", slider });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi khi tạo slider", message: error.message });
  }
};

// PUT /api/sliders/:id - Cập nhật slider (Admin only)
exports.updateSlider = async (req, res) => {
  try {
    const { title, image, link } = req.body;

    const slider = await Slider.findByIdAndUpdate(
      req.params.id,
      { title, image, link },
      { new: true, runValidators: true }
    );

    if (!slider) {
      return res.status(404).json({ error: "Không tìm thấy slider" });
    }

    res.json({ message: "Cập nhật slider thành công", slider });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi khi cập nhật slider", message: error.message });
  }
};

// DELETE /api/sliders/:id - Xóa slider (Admin only)
exports.deleteSlider = async (req, res) => {
  try {
    const slider = await Slider.findByIdAndDelete(req.params.id);

    if (!slider) {
      return res.status(404).json({ error: "Không tìm thấy slider" });
    }

    res.json({ message: "Xóa slider thành công" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi khi xóa slider", message: error.message });
  }
};
