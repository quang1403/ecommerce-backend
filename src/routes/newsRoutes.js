const express = require("express");
const router = express.Router();
const newsController = require("../controllers/newsController");
const { auth } = require("../middleware/auth");

// Lấy tin tức từ RSS (1 nguồn)
router.get("/rss", newsController.getNewsFromRSS);
// Đồng bộ nhiều nguồn RSS
router.get("/sync-rss", newsController.syncAllRSS);
// Lấy danh sách bài viết (phân trang, lọc tag, tìm kiếm)
router.get("/", newsController.getNews);
// Lấy chi tiết bài viết
router.get("/:id", newsController.getNewsById);
// Thêm bài viết mới (cần xác thực)
router.post("/", auth, newsController.createNews);
// Sửa bài viết (cần xác thực)
router.put("/:id", auth, newsController.updateNews);
// Xóa bài viết (cần xác thực)
router.delete("/:id", auth, newsController.deleteNews);

module.exports = router;
