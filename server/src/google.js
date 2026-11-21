import { OAuth2Client } from 'google-auth-library';
import { config } from './config.js';
import { HttpError } from './auth.js';

const client = new OAuth2Client();

/**
 * Checks a Google ID token (the "credential" from the Sign in with Google button):
 * Google's signature, that it was issued for our client ID, not expired, and a verified email.
 */
export async function verifyGoogleToken(credential) {
  if (!config.googleClientId) throw new HttpError(503, 'Google sign-in is not set up yet. Use email and password.');
  if (typeof credential !== 'string' || credential.length > 4096) throw new HttpError(400, 'Google sign-in failed. Please try again.');
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Google sign-in failed. Please try again.');
  }
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new HttpError(401, 'Your Google account email is not verified.');
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: (payload.name || payload.given_name || payload.email.split('@')[0]).slice(0, 80),
  };
}
