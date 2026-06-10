import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import * as authService from '../services/authService.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';

function getGoogleCallbackURL() {
  const base = BASE_URL.replace(/\/$/, '');
  const prefix = process.env.API_PREFIX ?? '';
  const path = prefix ? `${prefix}/auth/google/callback` : '/auth/google/callback';
  return `${base}${path}`;
}

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: getGoogleCallbackURL(),
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName ?? profile.name?.givenName ?? 'User';
          const picture = profile.photos?.[0]?.value ?? null;
          if (!email) {
            return done(new Error('No email from Google'));
          }
          const user = await authService.findOrCreateUser({ email, name, picture });
          const { token: refreshTokenValue, expiresAt } = await authService.createRefreshToken(
            user._id,
            'google',
            profile.id
          );
          done(null, {
            user,
            refreshTokenValue,
            expiresAt,
          });
        } catch (err) {
          done(err);
        }
      }
    )
  );
}

export default passport;
