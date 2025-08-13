/**
 * VPN Logger Utility - HNEE VPN
 *
 * Dieses Modul loggt alle VPN-bezogenen Aktionen und Events mit IP, GeoLocation, Device und Zeitstempel.
 *
 * Features:
 * - Logging von VPN-Events (View, Create, Delete, Download, etc.)
 * - GeoIP- und Device-Analyse
 * - Speicherung in vpn.log und Ausgabe über Winston-Logger
 *
 * Hinweise:
 * - Logdatei: backend/logs/vpn.log
 * - Für Security- und Audit-Zwecke
 *
 * @author Paul Buchwald
 * @version 1.0.0
 */
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from './securityLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Loggt VPN-bezogene Events mit IP, GeoLocation, Device, Name und Timestamp.
 * @param {Object} req - Express Request Objekt
 * @param {string} action - Aktion (z.B. VIEW, CREATE, DELETE)
 * @param {string} details - Weitere Details
 */
export function logVPNEvent(req, action, details = '') {
  const ip = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || 'unknown';
  const geo = geoip.lookup(ip) || {};
  const ua = req.headers['user-agent'] || '';
  const parser = new UAParser(ua);
  const deviceInfo = parser.getResult();
  const logEntry = {
    timestamp: new Date().toISOString(),
    username: req.user?.username || 'unknown',
    action,
    details,
    ip,
    geo,
    device: deviceInfo.device?.type || 'unknown',
    deviceName: deviceInfo.device?.model || deviceInfo.os?.name || 'unknown',
    userAgent: ua
  };
  logger.info(`[VPN LOG] ${JSON.stringify(logEntry)}`);
  // Write to vpn.log file
  try {
    const logPath = path.resolve(__dirname, '../logs/vpn.log');
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf8');
  } catch (err) {
    logger.error(`[VPN LOG ERROR] Could not write to vpn.log: ${err.message}`);
  }
}
