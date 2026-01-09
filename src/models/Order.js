// src/models/Order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: "Product",
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        memory: {
          type: String,
          required: false,
        },
        color: {
          type: String,
          required: false,
        },
        ram: {
          type: String,
          required: false,
        },
        storage: {
          type: String,
          required: false,
        },
        variant: {
          type: Object,
          required: false,
        },
        warrantyMonths: {
          type: Number,
          required: false,
          default: 12,
        },
      },
    ],
    total: {
      type: Number,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "online", "creditCard", "installment"],
      required: true,
      default: "cod",
    },
    status: {
      type: Number,
      enum: [0, 1, 2, 3, 4],
      default: 0,
      required: true,
    },
    // Thông tin trả góp (nếu có)
    installment: {
      isInstallment: {
        type: Boolean,
        default: false,
      },
      type: {
        type: String,
        enum: ["creditCard", "financeCompany"],
      },
      upfront: {
        type: Number,
        default: 0,
      },
      months: {
        type: Number,
        default: 0,
      },
      interestRate: {
        type: Number,
        default: 0,
      },
      monthlyPayment: {
        type: Number,
        default: 0,
      },
      totalPayment: {
        type: Number,
        default: 0,
      },
      transactionId: {
        type: String,
      },
      financeStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
      },
      // Thông tin khách hàng - ĐÃ CẬP NHẬT
      customerInfo: {
        // Cho thẻ tín dụng
        cardHolder: String,
        cardNumber: String,
        bank: String,
        // Cho công ty tài chính
        fullName: String,
        idNumber: String,
        // Chung
        phone: String,
        email: String,
        address: String,
        monthlyIncome: String,
        relativePhone1: String,
        relativePhone2: String,
      },
      // Giấy tờ upload - THÊM MỚI
      uploadedDocuments: {
        idCardFront: String,
        idCardBack: String,
        householdBook: String,
        incomeProof: String,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
