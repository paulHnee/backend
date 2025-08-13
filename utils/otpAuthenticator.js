import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'crypto';

// Temporärer TOTP-Secret-Speicher im Arbeitsspeicher: Benutzername -> Secret
const totpSecrets = new Map();

/**
 * Prüft, ob ein Admin verfügbar ist (Demo: immer false)
 * TODO: Echte Logik für Admin-Präsenz implementieren (z.B. Online-User, Session-DB)
 */
export function isAdminAvailable() {
  return false;
}

/**
 * Generiert und speichert ein TOTP-Secret für den Benutzer, gibt Secret und otpauth-URL zurück
 * @param {string} username - Benutzername
 * @param {string} issuer - Ausstellername für die Authenticator-App
 * @returns {object} Secret und otpauth-URL
 */
export function generateTOTPSecretForUser(username, issuer = 'HNEE VPN') {
  if (!username) throw new Error('Benutzername erforderlich');
  let secret = totpSecrets.get(username);
  if (!secret) {
    secret = authenticator.generateSecret();
    totpSecrets.set(username, secret);
  }
  const otpauth = authenticator.keyuri(username, issuer, secret);
  return { secret, otpauth };
}

/**
 * Gibt eine QR-Code Data-URL für das TOTP-Setup des Benutzers zurück
 * @param {string} username - Benutzername
 * @param {string} issuer - Ausstellername
 * @returns {Promise<string>} QR-Code als Data-URL
 */
export async function getTOTPQRCode(username, issuer = 'HNEE VPN') {
  const { otpauth } = generateTOTPSecretForUser(username, issuer);
  return await qrcode.toDataURL(otpauth);
}

/**
 * Prüft einen TOTP-Code für den Benutzer
 * @param {string} username - Benutzername
 * @param {string} token - TOTP-Code
 * @returns {boolean} true wenn gültig, sonst false
 */
export function verifyTOTPForUser(username, token) {
  const secret = totpSecrets.get(username);
  if (!secret) return false;
  return authenticator.check(token, secret);
}

/**
 * Middleware: Erlaubt VPN-Zugriff nur mit Admin oder gültigem TOTP
 * @param {object} req - Express Request
 * @param {object} res - Express Response
 * @param {function} next - Weiterführende Middleware
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
