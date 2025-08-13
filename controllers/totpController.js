import { getTOTPQRCode, verifyTOTPForUser } from '../utils/otpAuthenticator.js';

/**
 * API-Handler: Liefert TOTP QR-Code für Authenticator App
 * Route: GET /api/vpn/totp-setup
 */
export const getTOTPSetup = async (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
  }
  try {
    const qrCodeDataUrl = await getTOTPQRCode(username);
    res.json({ success: true, qrCode: qrCodeDataUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * API-Handler: Verifiziert TOTP Code vom Authenticator
 * Route: POST /api/vpn/totp-verify
 */
export const verifyTOTP = async (req, res) => {
  const username = req.user?.username;
  const { token } = req.body;
  if (!username || !token) {
    return res.status(400).json({ success: false, error: 'Token und Benutzer erforderlich' });
  }
  if (!verifyTOTPForUser(username, token)) {
    return res.status(401).json({ success: false, error: 'Ungültiger oder abgelaufener TOTP-Code' });
  }
  req.session = req.session || {};
  req.session.vpnOtpVerified = true;
  res.json({ success: true });
};
