# 📁 Datasets Directory

Thư mục này chứa dữ liệu training và analytics cho AI chatbot.

## Cấu Trúc

### 📂 training/

Lưu trữ tất cả tương tác chat thành công để training model.

**Format file**: `training_YYYY-MM-DD.jsonl`

**Cấu trúc mỗi dòng**:

```json
{
  "sessionId": "guest_123...",
  "userMessage": "Tìm iPhone 15 Pro Max",
  "detectedIntent": "product_inquiry",
  "botResponse": "Tôi tìm thấy các sản phẩm...",
  "wasHelpful": true,
  "timestamp": "2025-11-19T..."
}
```

### 📂 suggestions/

Lưu các gợi ý sản phẩm thành công.

**Format file**: `suggestions_YYYY-MM-DD.jsonl`

**Cấu trúc**:

```json
{
  "sessionId": "guest_123...",
  "userMessage": "Tìm điện thoại gaming",
  "suggestedProducts": [
    { "id": "...", "name": "iPhone 15 Pro", "price": 28990000 }
  ],
  "userSelected": "product_id",
  "timestamp": "2025-11-19T..."
}
```

### 📂 mistakes/

Lưu các lỗi hoặc response không tốt để cải thiện.

**Format file**: `mistakes_YYYY-MM-DD.jsonl`

**Cấu trúc**:

```json
{
  "sessionId": "guest_123...",
  "userMessage": "...",
  "detectedIntent": "product_inquiry",
  "actualIntent": "installment_inquiry",
  "botResponse": "...",
  "feedback": "not_helpful",
  "timestamp": "2025-11-19T..."
}
```

### 📄 dataset_qa.jsonl

Dataset tổng hợp định dạng chuẩn để fine-tuning OpenAI.

**Format**: JSONL (mỗi dòng là một JSON object)

```json
{
  "messages": [
    { "role": "system", "content": "Bạn là trợ lý..." },
    { "role": "user", "content": "Câu hỏi" },
    { "role": "assistant", "content": "Câu trả lời" }
  ]
}
```

## Sử Dụng

### Tự động lưu khi user chat

Dữ liệu tự động được lưu vào các file tương ứng mỗi khi:

- User gửi message → lưu vào `training/`
- Bot gợi ý sản phẩm → lưu vào `suggestions/`
- User feedback "not helpful" → lưu vào `mistakes/`

### Xuất dataset để fine-tuning

```javascript
const DatasetService = require("./services/ai/dataset.service");
const service = new DatasetService();

await service.exportForFineTuning("./src/datasets/dataset_qa.jsonl");
```

### Phân tích dữ liệu

```javascript
const stats = await service.analyzeTrainingData();
console.log(stats);
// {
//   totalInteractions: 1000,
//   intentDistribution: {...},
//   helpfulnessRate: 85.5,
//   topQueries: [...]
// }
```

### Dọn dẹp dữ liệu cũ

```javascript
// Xóa file cũ hơn 90 ngày
await service.cleanOldData();
```

## Lưu Ý

- Files được tạo tự động theo ngày
- Format JSONL cho phép append dữ liệu dễ dàng
- Mỗi dòng là một JSON object độc lập
- Dữ liệu nhạy cảm (user info) được mã hóa hoặc bỏ qua
- Auto backup sang MongoDB qua ChatLog model

## Monitoring

Kiểm tra dung lượng:

```bash
du -sh datasets/*
```

Đếm số dòng:

```bash
wc -l datasets/training/*.jsonl
```
