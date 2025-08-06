/**
 * Simplified Admin Routes - HNEE Service Portal
 * 
 * Vereinfachte Admin-Funktionen für ITSZ-Team
 * Fokus auf System-Monitoring ohne Anfragen-Management
 */

import express from 'express';
import { getSystemMetrics } from '../controllers/dashboardController.js';

const router = express.Router();

// ===== BASIC ADMIN FUNCTIONS =====

/**
 * System-Status für ITSZ-Dashboard
 */
router.get('/system-status', getSystemMetrics);

/**
 * Einfache Benutzer-Übersicht
 */
router.get('/users', async (req, res) => {
  try {
    const adminUser = req.user?.username || 'unknown';
    
    // Nur für ITSZ-Team
    if (!['itsz.admin', 'paul.buchwald', 'admin'].includes(adminUser)) {
      return res.status(403).json({
        error: 'Zugriff verweigert - ITSZ-Team erforderlich'
      });
    }

    // Mock-Benutzer-Statistiken
    const userStats = {
      total: 2847,
      active: 2723,
      inactive: 124,
      students: 2156,
      staff: 234,
      faculty: 89,
      guests: 244,
      recentActivity: [
        { date: '2025-08-06', logins: 456, emailAccess: 423 },
        { date: '2025-08-05', logins: 523, emailAccess: 445 },
        { date: '2025-08-04', logins: 389, emailAccess: 367 }
      ]
    };

    res.json({
      success: true,
      userStats: userStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Fehler beim Laden der Benutzer-Übersicht',
      details: error.message
    });
  }
});

export default router;
