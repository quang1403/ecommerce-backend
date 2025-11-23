const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    images: [{ type: String }],

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
    color: { type: [String] }, // danh sách màu: ["Black", "Blue", "White"]
    variants: [
      {
        ram: { type: Number },
        storage: { type: Number },
        price: { type: Number },
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

module.exports = mongoose.model("Product", ProductSchema);
