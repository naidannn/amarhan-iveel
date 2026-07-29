'use strict';

const passport = require('passport');
const config = require('../config');
const User = require('../models/user.model');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Only set up Google OAuth if credentials are configured
if (config.server.googleClientID && config.server.googleClientSecret) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.server.googleClientID,
        clientSecret: config.server.googleClientSecret,
        callbackURL: config.server.callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const existingUser = await User.findOne({ googleId: profile.id });
          if (existingUser) {
            return done(null, existingUser);
          }
          const newUser = await new User({
            googleId: profile.id,
            username: profile.displayName,
            thumbnail: profile._json.picture,
            email: profile._json.email,
            firstname: profile.name?.givenName || profile.displayName,
            lastname: profile.name?.familyName || '',
            password: Math.random().toString(36).slice(-12),
          }).save();
          done(null, newUser);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
}
