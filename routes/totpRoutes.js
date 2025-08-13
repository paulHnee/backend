import express from 'express';
import { getTOTPSetup, verifyTOTP } from '../controllers/totpController.js';

const router = express.Router();

// GET /api/vpn/totp-setup - returns QR code for authenticator app
router.get('/totp-setup', getTOTPSetup);

// POST /api/vpn/totp-verify - verifies TOTP code
router.post('/totp-verify', verifyTOTP);

export default router;
