import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'crypto';

// In-memory TOTP secret store: username -> secret
const totpSecrets = new Map();

export function isAdminAvailable() {
  // TODO: Implement real admin presence check (e.g. online users, session DB)
  return false;
}

/**
 * Generates and stores a TOTP secret for the user, returns secret and otpauth URL
 */
export function generateTOTPSecretForUser(username, issuer = 'HNEE VPN') {
  if (!username) throw new Error('Username required');
  let secret = totpSecrets.get(username);
  if (!secret) {
    secret = authenticator.generateSecret();
    totpSecrets.set(username, secret);
  }
  const otpauth = authenticator.keyuri(username, issuer, secret);
  return { secret, otpauth };
}

/**
 * Returns a QR code data URL for the user's TOTP setup
 */
export async function getTOTPQRCode(username, issuer = 'HNEE VPN') {
  const { otpauth } = generateTOTPSecretForUser(username, issuer);
  return await qrcode.toDataURL(otpauth);
}

/**
 * Verifies a TOTP code for the user
 */
export function verifyTOTPForUser(username, token) {
  const secret = totpSecrets.get(username);
  if (!secret) return false;
  return authenticator.check(token, secret);
}

/**
 * Middleware: Allows VPN access only with admin or valid TOTP
 */
export function requireVPNAccess(req, res, next) {
  if (req.user?.isITEmployee || isAdminAvailable()) {
    return next();
  }
  if (req.session?.vpnOtpVerified) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'VPN-Zugriff nur mit gültigem OTP möglich' });
}
