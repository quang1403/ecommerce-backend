// src/controllers/sliderController.js

// Danh sách slider ảnh tĩnh (đường dẫn bắt đầu bằng /images ... vì đã expose static)
const sliders = [
  { id: 2, image: "/images/slider2.png", link: "/", title: "Slider 2" },
  { id: 3, image: "/images/slider3.png", link: "/", title: "Slider 3" },
  { id: 1, image: "/images/slider1.png", link: "/", title: "Slider 1" },
];

exports.getSliders = (req, res) => {
  res.json(sliders);
};
