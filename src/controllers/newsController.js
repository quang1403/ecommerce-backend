const News = require("../models/News");
const Parser = require("rss-parser");
const parser = new Parser();
// Đồng bộ nhiều nguồn RSS
const rssSources = [
  "https://techcrunch.com/feed/",
  "https://vnexpress.net/rss/so-hoa.rss",
];

exports.syncAllRSS = async (req, res) => {
  let totalSaved = 0;
  for (const url of rssSources) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        const exists = await News.findOne({
          title: item.title,
          publishedDate: item.pubDate,
        });
        if (!exists) {
          await News.create({
            title: item.title,
            content: item.contentSnippet || item.content || "",
            image: item.enclosure?.url || "",
            author: item.creator || item.author || "",
            publishedDate: item.pubDate ? new Date(item.pubDate) : new Date(),
            source: item.link || url,
            tags: item.categories || [],
          });
          totalSaved++;
        }
      }
    } catch (err) {
      console.error(`Lỗi đồng bộ nguồn ${url}:`, err);
    }
  }
  if (res) {
    res.json({ success: true, saved: totalSaved });
  }
};

// Lấy danh sách bài viết (phân trang, lọc tag, tìm kiếm)
exports.getNews = async (req, res) => {
  try {
    const { page = 1, limit = 10, tag, search, featured } = req.query;
    let query = {};
    if (tag) query.tags = tag;
    if (search) query.title = { $regex: search, $options: "i" };
    if (featured !== undefined) {
      query.featured = featured === "true";
    }
    const total = await News.countDocuments(query);
    const news = await News.find(query)
      .sort({ publishedDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({
      success: true,
      data: news,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy chi tiết bài viết
exports.getNewsById = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: news });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Thêm bài viết mới
exports.createNews = async (req, res) => {
  try {
    const news = new News(req.body);
    await news.save();
    res.status(201).json({ success: true, data: news });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Sửa bài viết
exports.updateNews = async (req, res) => {
  try {
    const news = await News.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!news)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: news });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Xóa bài viết
exports.deleteNews = async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    if (!news)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy tin tức từ RSS
exports.getNewsFromRSS = async (req, res) => {
  try {
    // Nguồn RSS chuẩn về tin công nghệ Việt Nam (GenK)
    const rssUrl = req.query.url || "https://genk.vn/rss/ict.rss";
    const feed = await parser.parseURL(rssUrl);

    // Lưu từng bài viết vào database nếu chưa tồn tại (dựa vào title và publishedDate)
    let savedCount = 0;
    for (const item of feed.items) {
      const exists = await News.findOne({
        title: item.title,
        publishedDate: item.pubDate,
      });
      if (!exists) {
        await News.create({
          title: item.title,
          content: item.contentSnippet || item.content || "",
          image: item.enclosure?.url || "",
          author: item.creator || item.author || "",
          publishedDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          source: item.link || rssUrl,
          tags: item.categories || [],
        });
        savedCount++;
      }
    }
    res.json({ success: true, data: feed.items, saved: savedCount });
  } catch (err) {
    console.error(err); // Thêm dòng này để log lỗi ra console
    res.status(500).json({ success: false, message: err.message });
  }
};
