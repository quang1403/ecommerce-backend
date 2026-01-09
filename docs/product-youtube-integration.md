# Hướng Dẫn Tích Hợp Đăng Nhập Google OAuth

## 📋 Tổng Quan

Hệ thống đã được tích hợp đăng nhập Google OAuth 2.0, cho phép người dùng đăng nhập nhanh chóng bằng tài khoản Google của họ.

---

## 🔧 Backend - Đã Cấu Hình

### 1. Dependencies đã cài đặt

```bash
npm install passport passport-google-oauth20 express-session
```

### 2. Cấu trúc Files Backend

#### **File: `.env`**

```env
# Google OAuth
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
GOOGLE_CALLBACK_URL=http://localhost:5000/api/users/auth/google/callback

# Session Secret
SESSION_SECRET=cadd33060b23cac4df909e5e0e33e92c81d05e19209d44e302d4af1fe91910c2
```

#### **File: `src/config/passport.js`** ✅ Đã tạo

Cấu hình Google Strategy cho Passport.js

#### **File: `src/models/User.js`** ✅ Đã cập nhật

Thêm các fields:

- `googleId`: ID từ Google
- `avatar`: URL ảnh đại diện
- `authProvider`: "local" hoặc "google"
- `password`: Không bắt buộc (cho user đăng nhập bằng Google)

#### **File: `src/controllers/userController.js`** ✅ Đã thêm

- `exports.googleAuthSuccess`: Xử lý sau khi đăng nhập Google thành công
- `exports.googleAuthFailure`: Xử lý khi đăng nhập thất bại

#### **File: `src/routes/userRoutes.js`** ✅ Đã thêm routes

```javascript
// Google OAuth Routes
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/users/auth/google/failure",
    session: false,
  }),
  userController.googleAuthSuccess
);
router.get("/auth/google/failure", userController.googleAuthFailure);
```

#### **File: `server.js`** ✅ Đã cập nhật

- Import passport và session
- Cấu hình express-session
- Initialize passport

### 3. API Endpoints

| Method | Endpoint                          | Mô tả                                   |
| ------ | --------------------------------- | --------------------------------------- |
| GET    | `/api/users/auth/google`          | Bắt đầu flow đăng nhập Google           |
| GET    | `/api/users/auth/google/callback` | Google redirect về đây sau khi xác thực |
| GET    | `/api/users/auth/google/failure`  | Xử lý khi đăng nhập thất bại            |

---

## 🎨 Frontend - Hướng Dẫn Tích Hợp

### 1. Tạo Button Đăng Nhập Google

#### **React Component Example**

```jsx
// components/GoogleLoginButton.jsx
import React from "react";

const GoogleLoginButton = () => {
  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5000/api/users/auth/google";
  };

  return (
    <button
      onClick={handleGoogleLogin}
      className="google-login-btn"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 20px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        backgroundColor: "white",
        cursor: "pointer",
      }}
    >
      <img
        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        alt="Google"
        width="20"
      />
      Đăng nhập với Google
    </button>
  );
};

export default GoogleLoginButton;
```

### 2. Tạo Trang Xử Lý Callback

#### **File: `pages/AuthGoogleSuccess.jsx`**

```jsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

function AuthGoogleSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const userStr = searchParams.get("user");

    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));

        // Lưu token và user info vào localStorage
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));

        // Hiển thị thông báo thành công (optional)
        console.log("Đăng nhập thành công!", user);

        // Redirect về trang chủ
        setTimeout(() => {
          navigate("/");
        }, 500);
      } catch (error) {
        console.error("Error parsing user data:", error);
        navigate("/login?error=invalid_data");
      }
    } else {
      navigate("/login?error=missing_token");
    }
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h2>⏳ Đang xử lý đăng nhập...</h2>
        <p>Vui lòng đợi trong giây lát</p>
      </div>
    </div>
  );
}

export default AuthGoogleSuccess;
```

### 3. Cấu Hình Router

#### **File: `App.jsx` hoặc `router/index.jsx`**

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthGoogleSuccess from "./pages/AuthGoogleSuccess";
import Login from "./pages/Login";
import Home from "./pages/Home";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/google/success" element={<AuthGoogleSuccess />} />
        {/* ... other routes */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### 4. Tích Hợp vào Trang Login

```jsx
// pages/Login.jsx
import React, { useState } from "react";
import axios from "axios";
import GoogleLoginButton from "../components/GoogleLoginButton";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "http://localhost:5000/api/users/login",
        {
          email,
          password,
        }
      );

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      window.location.href = "/";
    } catch (error) {
      alert(error.response?.data?.error || "Đăng nhập thất bại");
    }
  };

  return (
    <div className="login-container">
      <h2>Đăng Nhập</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Đăng nhập</button>
      </form>

      <div
        className="divider"
        style={{ margin: "20px 0", textAlign: "center" }}
      >
        <span>HOẶC</span>
      </div>

      <GoogleLoginButton />
    </div>
  );
}

export default Login;
```

### 5. Utility Functions cho Authentication

#### **File: `utils/auth.js`**

```javascript
// Kiểm tra user đã đăng nhập chưa
export const isAuthenticated = () => {
  const token = localStorage.getItem("token");
  return !!token;
};

// Lấy thông tin user hiện tại
export const getCurrentUser = () => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

// Lấy token
export const getToken = () => {
  return localStorage.getItem("token");
};

// Đăng xuất
export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
};

// Axios interceptor để tự động thêm token vào header
export const setupAxiosInterceptors = (axios) => {
  axios.interceptors.request.use(
    (config) => {
      const token = getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        logout();
      }
      return Promise.reject(error);
    }
  );
};
```

### 6. Protected Route Component

```jsx
// components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";

const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default ProtectedRoute;

// Sử dụng:
// <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
```
