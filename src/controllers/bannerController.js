// src/controllers/bannerController.js

const banners = [
  { id: 1, image: "/images/banner1.jpg", link: "/", title: "Banner 1" },
  { id: 2, image: "/images/banner2.jpg", link: "/", title: "Banner 2" },
];

exports.getBanners = (req, res) => {
  res.json(banners);
};
