const mongoose = require("mongoose");

const chatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Cho phép guest users chat
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      default: () =>
        `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant", "system"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    context: {
      // Lưu context hội thoại để chatbot hiểu ngữ cảnh
      currentProduct: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      compareProducts: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
      ],
      filters: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      lastIntent: {
        type: String, // "search", "compare", "order_tracking", "warranty", etc.
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index để tìm kiếm nhanh
chatSessionSchema.index({ userId: 1, isActive: 1 });
chatSessionSchema.index({ lastActivity: -1 });

// Method để thêm message mới
chatSessionSchema.methods.addMessage = function (role, content, metadata = {}) {
  this.messages.push({ role, content, metadata });
  this.lastActivity = new Date();
  return this.save();
};

module.exports = mongoose.model("ChatSession", chatSessionSchema);
