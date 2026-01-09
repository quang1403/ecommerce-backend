const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const multer = require("multer");
const path = require("path");

// ===== Multer setup =====
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // lưu file vào thư mục uploads
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // đặt tên file duy nhất
  },
});
const upload = multer({ storage: storage });

/* ==========================
        PRODUCT ROUTES
========================== */

//  Lấy sản phẩm theo brandId (optionally filtered by category)
router.get("/brand/:brandId", async (req, res) => {
  try {
    const { brandId } = req.params;
    const { category } = req.query;
    const query = { brand: brandId };
    if (category) query.category = category;

    const products = await Product.find(query)
      .populate("brand", "name logo")
      .populate("category", "name");
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

//  Lấy danh sách brand từ sản phẩm (optionally filtered by category)
router.get("/brands", async (req, res) => {
  try {
    const { category } = req.query;
    const query = {};
    if (category) query.category = category; // only products in this category

    const products = await Product.find(query, "brand").populate(
      "brand",
      "name logo"
    );
    const brands = products.map((p) => p.brand).filter((b) => b !== null); // lọc brand null
    const uniqueBrands = [
      ...new Map(brands.map((b) => [b._id.toString(), b])).values(),
    ];
    res.json({ success: true, data: uniqueBrands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// Search sản phẩm theo keyword (tìm cả tên sản phẩm, mô tả, brand)
router.get("/search", async (req, res) => {
  try {
    const {
      keyword,
      minPrice,
      maxPrice,
      category,
      brand,
      sort,
      page = 1,
      limit = 20,
      isLatest,
      featured,
    } = req.query;
    let query = {};

    // Tìm kiếm thông minh: chuẩn hóa keyword và tên sản phẩm (bỏ dấu cách, chữ thường)
    if (keyword && keyword.trim() !== "") {
      const norm = (str) => (str || "").toLowerCase().replace(/\s+/g, "");
      const normKeyword = norm(keyword);
      // Tìm brand nào có tên khớp keyword
      const brands = await require("../models/Brand").find();
      const brandIds = brands
        .filter((b) => norm(b.name).includes(normKeyword))
        .map((b) => b._id);

      // Tìm tất cả sản phẩm, filter lại bằng js cho search gần đúng
      let allProducts = await Product.find({})
        .populate("brand", "name logo")
        .populate("category", "name");
      allProducts = allProducts.filter((p) => {
        const nameNorm = norm(p.name);
        const descNorm = norm(p.description);
        return (
          nameNorm.includes(normKeyword) ||
          descNorm.includes(normKeyword) ||
          (p.brand && brandIds.some((id) => id.equals(p.brand._id)))
        );
      });
      // Sau khi filter, apply các filter khác (giá, category, brand...)
      let filtered = allProducts;
      if (minPrice || maxPrice) {
        filtered = filtered.filter((p) => {
          if (minPrice && p.price < Number(minPrice)) return false;
          if (maxPrice && p.price > Number(maxPrice)) return false;
          return true;
        });
      }
      if (category && category !== "") {
        filtered = filtered.filter(
          (p) => p.category && p.category._id == category
        );
      }
      if (brand) {
        filtered = filtered.filter((p) => p.brand && p.brand._id == brand);
      }
      // Sắp xếp
      if (sort) {
        if (sort === "price_asc") filtered.sort((a, b) => a.price - b.price);
        else if (sort === "price_desc")
          filtered.sort((a, b) => b.price - a.price);
        else if (sort === "name_asc")
          filtered.sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === "name_desc")
          filtered.sort((a, b) => b.name.localeCompare(a.name));
      }
      // Phân trang
      const total = filtered.length;
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 20;
      const paged = filtered.slice(
        (pageNum - 1) * limitNum,
        pageNum * limitNum
      );
      return res.json({
        success: true,
        data: paged,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    // Lọc theo khoảng giá
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Lọc theo category
    if (category && category !== "") {
      query.category = category;
    }

    // Lọc theo brand
    if (brand) {
      query.brand = brand;
    }

    // Lọc sản phẩm mới
    if (isLatest !== undefined) {
      query.isLatest = isLatest === "true";
    }

    // Lọc sản phẩm nổi bật
    if (featured !== undefined) {
      query.featured = featured === "true";
    }

    // Phân trang
    const skip = (Number(page) - 1) * Number(limit);

    // Sắp xếp
    let sortOption = {};
    if (sort) {
      // sort=price_asc, price_desc, name_asc, name_desc
      if (sort === "price_asc") sortOption.price = 1;
      else if (sort === "price_desc") sortOption.price = -1;
      else if (sort === "name_asc") sortOption.name = 1;
      else if (sort === "name_desc") sortOption.name = -1;
    }

    const products = await Product.find(query)
      .populate("brand", "name logo")
      .populate("category", "name")
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    // Đếm tổng số kết quả
    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
//  Lấy tất cả sản phẩm (có thể filter theo query parameters)
router.get("/", async (req, res) => {
  try {
    let query = {};

    // Filter theo isLatest
    if (req.query.isLatest !== undefined) {
      query.isLatest = req.query.isLatest === "true";
    }

    // Filter theo featured
    if (req.query.featured !== undefined) {
      query.featured = req.query.featured === "true";
    }

    // Filter theo brand
    if (req.query.brand) {
      query.brand = req.query.brand;
    }

    // Filter theo category
    if (req.query.category) {
      query.category = req.query.category;
    }

    const products = await Product.find(query)
      .populate("brand", "name logo")
      .populate("category", "name");
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

//  Lấy chi tiết sản phẩm theo ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("brand", "name logo")
      .populate("category", "name");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//  Thêm sản phẩm (Admin)
router.post("/", async (req, res) => {
  try {
    console.log("[ADD PRODUCT] Payload:", req.body);
    const newProduct = new Product(req.body);
    await newProduct.save();
    const populated = await Product.findById(newProduct._id)
      .populate("brand", "name logo")
      .populate("category", "name");
    console.log("[ADD PRODUCT] Success:", populated);
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error("[ADD PRODUCT] Error:", err);
    res.status(400).json({ success: false, error: err.message });
  }
});

//  Upload ảnh sản phẩm
router.post("/upload", upload.single("image"), (req, res) => {
  try {
    res.json({
      success: true,
      message: "Upload thành công",
      file: req.file,
      url: `/uploads/${req.file.filename}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//  Cập nhật sản phẩm
router.put("/:id", async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    })
      .populate("brand", "name logo")
      .populate("category", "name");

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

//  Xóa sản phẩm
router.delete("/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
