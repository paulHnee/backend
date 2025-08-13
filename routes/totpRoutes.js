/**
 * TOTP-Routen für VPN-Bereich
 *
 * Beschreibung:
 *   - Stellt Endpunkte für die Einrichtung und Verifizierung von TOTP bereit
 *   - GET /api/vpn/totp-setup: Gibt QR-Code für Authenticator-App zurück
 *   - POST /api/vpn/totp-verify: Überprüft TOTP-Code
 *
 * @author Paul Buchwald
 * @updated 13. August 2025
 */
import express from 'express';
import { getTOTPSetup, verifyTOTP } from '../controllers/totpController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/vpn/totp-setup - returns QR code for authenticator app
router.get('/totp-setup', verifyToken, getTOTPSetup);

// POST /api/vpn/totp-verify - verifies TOTP code
router.post('/totp-verify', verifyToken, verifyTOTP);

export default router;
