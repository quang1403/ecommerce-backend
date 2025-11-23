/**
 * ChatLog Model
 * Lưu trữ toàn bộ Q&A để training và phân tích
 */

const mongoose = require("mongoose");

const chatLogSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  // Tin nhắn người dùng
  userMessage: {
    type: String,
    required: true,
  },

  // Intent được nhận diện
  detectedIntent: {
    type: String,
    required: true,
    enum: [
      "greeting",
      "product_inquiry",
      "installment_inquiry",
      "product_compare",
      "order_tracking",
      "stock_check",
      "recommendation",
      "general",
      "unknown",
    ],
  },

  // Độ tin cậy của intent
  intentConfidence: {
    type: Number,
    default: 1.0,
    min: 0,
    max: 1,
  },

  // Phản hồi của bot
  botResponse: {
    type: String,
    required: true,
  },

  // Dữ liệu liên quan (products, orders, etc.)
  contextData: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // Feedback từ user (helpful/not helpful)
  userFeedback: {
    type: String,
    enum: ["helpful", "not_helpful", "neutral", null],
    default: null,
  },

  // Rating từ user (1-5 sao)
  userRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null,
  },

  // Response time (ms)
  responseTime: {
    type: Number,
    default: 0,
  },

  // Có sử dụng AI không
  usedAI: {
    type: Boolean,
    default: true,
  },

  // Model được sử dụng
  aiModel: {
    type: String,
    default: "gpt-4o-mini",
  },

  // Tokens sử dụng
  tokensUsed: {
    prompt: { type: Number, default: 0 },
    completion: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },

  // Metadata
  metadata: {
    userAgent: String,
    ip: String,
    platform: String,
  },

  // Đánh dấu để training
  markedForTraining: {
    type: Boolean,
    default: false,
  },

  // Đánh dấu lỗi cần review
  markedAsError: {
    type: Boolean,
    default: false,
  },

  errorReason: {
    type: String,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Indexes
chatLogSchema.index({ sessionId: 1, createdAt: -1 });
chatLogSchema.index({ userId: 1, createdAt: -1 });
chatLogSchema.index({ detectedIntent: 1 });
chatLogSchema.index({ markedForTraining: 1 });
chatLogSchema.index({ markedAsError: 1 });

// Static methods

/**
 * Lấy logs theo session
 */
chatLogSchema.statics.getBySession = function (sessionId, limit = 50) {
  return this.find({ sessionId }).sort({ createdAt: -1 }).limit(limit).lean();
};

/**
 * Lấy logs để training
 */
chatLogSchema.statics.getForTraining = function (limit = 1000) {
  return this.find({
    markedForTraining: true,
    userFeedback: "helpful",
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Lấy logs lỗi cần review
 */
chatLogSchema.statics.getErrors = function (limit = 100) {
  return this.find({ markedAsError: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Thống kê theo intent
 */
chatLogSchema.statics.getIntentStats = async function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$detectedIntent",
        count: { $sum: 1 },
        avgResponseTime: { $avg: "$responseTime" },
        helpfulCount: {
          $sum: { $cond: [{ $eq: ["$userFeedback", "helpful"] }, 1, 0] },
        },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
};

const ChatLog = mongoose.model("ChatLog", chatLogSchema);

module.exports = ChatLog;
