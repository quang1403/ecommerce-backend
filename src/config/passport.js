const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Tìm user theo googleId
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // User đã tồn tại
          return done(null, user);
        }

        // Kiểm tra xem email đã được sử dụng chưa
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Email đã tồn tại nhưng chưa liên kết với Google
          // Liên kết tài khoản
          user.googleId = profile.id;
          user.authProvider = "google";
          user.avatar = profile.photos[0]?.value;
          await user.save();
          return done(null, user);
        }

        // Tạo user mới
        const newUser = new User({
          googleId: profile.id,
          fullName: profile.displayName,
          email: profile.emails[0].value,
          avatar: profile.photos[0]?.value,
          authProvider: "google",
          isActive: true,
        });

        await newUser.save();
        done(null, newUser);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

module.exports = passport;
