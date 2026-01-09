const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    images: [{ type: String }],

    // Thêm trường YouTube (link & video ID)
    youtubeUrl: { type: String },
    youtubeId: { type: String },

    // Liên kết tới Brand & Category
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    featured: { type: Boolean, default: false },
    rating: { type: Number, default: 0, min: 0, max: 5 },

    sold: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    /* ========= Thông số để lọc ========= */
    chipset: { type: String }, // ví dụ: Snapdragon 8 Gen 2
    ram: { type: Number }, // đơn vị: GB
    storage: { type: Number }, // đơn vị: GB
    battery: { type: Number }, // đơn vị: mAh
    displaySize: { type: Number }, // đơn vị: inch
    displayType: { type: String }, // ví dụ: AMOLED, LCD
    cameraRear: { type: String }, // ví dụ: "50MP + 12MP"
    cameraFront: { type: String }, // ví dụ: "32MP"
    os: { type: String }, // ví dụ: Android 14, iOS 17

    // Legacy field - kept for backward compatibility
    color: { type: [String] }, // danh sách màu đơn giản: ["Black", "Blue", "White"]

    // New: Color variants with images and stock
    colorVariants: [
      {
        color: { type: String, required: true }, // Tên màu: "Đen Titan", "Xanh Dương"
        colorCode: { type: String }, // Mã màu hex: "#1a1a1a", "#0066cc"
        images: [{ type: String }], // Danh sách ảnh cho màu này
        stock: { type: Number, default: 0 }, // Tồn kho riêng cho màu này
        sku: { type: String }, // Mã SKU riêng cho variant này
      },
    ],

    // Storage/RAM variants (existing)
    variants: [
      {
        ram: { type: Number },
        storage: { type: Number },
        price: { type: Number },
        stock: { type: Number, default: 0 }, // Stock riêng cho variant này
      },
    ], // các lựa chọn cấu hình: [{ram, storage, price}]

    isLatest: { type: Boolean, default: false }, // kiểm tra sản phẩm mới

    // Thông số chi tiết động cho từng loại sản phẩm
    specs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    }, // Object chứa thông số riêng: phone, accessory, etc.
  },
  { timestamps: true }
);

// Helper: extract YouTube video ID from various YouTube URL formats
function extractYouTubeId(url) {
  if (!url || typeof url !== "string") return null;
  // Match common patterns: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID, youtube.com/v/ID
  const match = url.match(
    /(?:youtube\.com\/(?:.*v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (match && match[1]) return match[1];
  // Fallback: look for v= param
  const paramsMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (paramsMatch && paramsMatch[1]) return paramsMatch[1];
  return null;
}

// Ensure youtubeId is set when creating/saving
ProductSchema.pre("save", function (next) {
  if (this.youtubeUrl) {
    const id = extractYouTubeId(this.youtubeUrl);
    if (id) this.youtubeId = id;
    else this.youtubeId = undefined;
  } else {
    this.youtubeId = undefined;
  }
  next();
});

// Ensure youtubeId is set when updating via findOneAndUpdate / findByIdAndUpdate
ProductSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (!update) return next();

  // Support both direct props and $set
  const payload = update.$set ? update.$set : update;
  if (payload.youtubeUrl !== undefined) {
    const id = extractYouTubeId(payload.youtubeUrl);
    if (id) {
      if (update.$set) update.$set.youtubeId = id;
      else update.youtubeId = id;
    } else {
      if (update.$set) update.$set.youtubeId = undefined;
      else update.youtubeId = undefined;
    }
  }
  next();
});

module.exports = mongoose.model("Product", ProductSchema);
