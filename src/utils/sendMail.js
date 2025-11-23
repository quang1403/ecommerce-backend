const nodemailer = require("nodemailer");
require("dotenv").config();

// Hàm gửi mail
const sendMail = async ({ to, subject, text, html }) => {
  try {
    // Cấu hình transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Gmail của bạn (file .env)
        pass: process.env.EMAIL_PASS, // App password 16 ký tự
      },
    });

    // Cấu hình nội dung email
    const mailOptions = {
      from: `"Phone Store" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    };

    // Gửi mail
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.response);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    throw error;
  }
};

module.exports = sendMail;
