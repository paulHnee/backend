/**
 * AuthController - Zentrale Authentifizierungs- und Autorisierungslogik
 * 
 * Diese Datei behandelt alle authentifizierungsbezogenen Anfragen für das HNEE LDAP System.
 * Hauptfunktionen:
 * - LDAP-basierte Benutzerauthentifizierung
 * - JWT-Token-Generierung und -Validierung
 * - HNEE-Gruppen-Extraktion und -Mapping
 * - Session-Management mit HttpOnly Cookies
 * - Sichere Logout-Funktionalität
 * 
 * Sicherheitsfeatures:
 * - HttpOnly Cookies für Token-Speicherung
 * - Sichere Cookie-Einstellungen (sameSite, secure)
 * - Automatische Token-Erneuerung
 * - LDAP-Gruppenvalidierung
 * 
 * @author ITSZ Team
 * @version 1.0.0
 */

import jwt from 'jsonwebtoken';
import ldapAuth from '../config/ldap.js';
import { isUserInGroup, getGroupMembers, searchGroups, mapUserRoles } from '../utils/ldapUtils.js';

/**
 * Behandelt Login-Anfragen mit LDAP-Authentifizierung und setzt ein HttpOnly-Cookie.
 * 
 * Ablauf:
 * 1. LDAP-Authentifizierung mit Username/Password
 * 2. Benutzerinformationen aus LDAP abrufen
 * 3. HNEE-Gruppen extrahieren und mappen
 * 4. JWT-Token generieren mit Benutzerinformationen
 * 5. Secure HttpOnly Cookie setzen
 * 
 * @param {Request} req - Express Request Objekt mit { username, password }
 * @param {Response} res - Express Response Objekt
 * @returns {Object} JSON Response mit Benutzerinformationen oder Fehlermeldung
 */
export const login = async (req, res) => {
  const { username, password } = req.body;
  console.log('Login-Versuch empfangen für:', username);

  try {
    // LDAP-Authentifizierung: Validiert Username/Password gegen LDAP-Server
    await new Promise((resolve, reject) => {
      ldapAuth.authenticate(username, password, (err, user) => {
        if (err || !user) {
          console.error('LDAP-Authentifizierung fehlgeschlagen für Benutzer:', username, err || 'Ungültige Anmeldedaten');
          return reject(new Error('Authentifizierung fehlgeschlagen: Benutzername oder Passwort ist falsch.'));
        }
        console.log('LDAP-Authentifizierung erfolgreich für Benutzer:', username);
        resolve(user);
      });
    });

    // Benutzerinformationen und Gruppenmitgliedschaften aus LDAP abrufen
    let userInfo;
    try {
      userInfo = await new Promise((resolve, reject) => {
        ldapAuth.getUserInfo(username, (err, info) => {
          if (err) {
            console.error('Fehler beim Abrufen der Benutzerinformationen:', err);
            reject(err);
          } else {
            resolve(info);
          }
        });
      });
    } catch (error) {
      console.error('LDAP getUserInfo fehlgeschlagen, verwende Fallback:', error.message);
      // Fallback: Grundlegende Benutzerinformationen ohne Gruppen
      // Wird verwendet wenn LDAP-Server temporär nicht verfügbar ist
      userInfo = { 
        username, 
        displayName: username, 
        email: `${username}@hnee.de`,
        groups: [],
        roles: []
      };
    }

    // JWT Token mit erweiterten Benutzerinformationen generieren
    const mappedRoles = mapUserRoles(userInfo.groups);
    
    const token = jwt.sign({ 
      username: userInfo.username,
      displayName: userInfo.displayName,
      email: userInfo.email,
      groups: userInfo.groups,
      roles: userInfo.roles,
      // Erweiterte Rolleninformationen
      ...mappedRoles
    }, process.env.JWT_SECRET, {
      expiresIn: '1d' // Gültigkeit auf 1 Tag setzen
    });

    // ANSTATT den Token im Body zu senden, setzen wir ein sicheres HttpOnly-Cookie.
    res.cookie('session_token', token, {
      httpOnly: true, // Verhindert den Zugriff über JavaScript im Browser
      secure: false, // Set to false for HTTP connections (change to true for HTTPS in production)
      sameSite: 'lax', // Changed from 'strict' to 'lax' for cross-origin requests
      path: '/', // Ensure cookie is available for all paths
      maxAge: 24 * 60 * 60 * 1000 // 1 Tag in Millisekunden
    });

    // Sende Erfolgsmeldung und erweiterte Benutzerdaten zurück (ohne Token)
    res.status(200).json({
      success: true,
      user: {
        username: userInfo.username,
        displayName: userInfo.displayName,
        email: userInfo.email,
        groups: userInfo.groups,
        roles: userInfo.roles,
        // Erweiterte Rolleninformationen
        ...mappedRoles
      }
    });

  } catch (error) {
    console.error('Login-Prozess fehlgeschlagen für Benutzer:', username, 'Fehler:', error);
    res.status(401).json({ error: 'Authentifizierung fehlgeschlagen', details: error.message });
  }
};

/**
 * NEU: Logout-Funktion zum Löschen des Cookies.
 * @param {Request} req - Express Request Objekt
 * @param {Response} res - Express Response Objekt
 */
export const logout = (req, res) => {
  // Lösche das Cookie, indem wir es mit einem abgelaufenen Datum überschreiben.
  res.cookie('session_token', '', {
    httpOnly: true,
    secure: false, // Match the login cookie settings
    sameSite: 'lax', // Match the login cookie settings
    path: '/', // Ensure cookie is cleared from all paths
    expires: new Date(0)
  });
  res.status(200).json({ message: 'Erfolgreich abgemeldet' });
};

/**
 * NEU: Funktion zur Überprüfung des Session-Status.
 * Wird von der Frontend-App beim Start aufgerufen.
 * @param {Request} req - Express Request Objekt (enthält das Cookie)
 * @param {Response} res - Express Response Objekt
 */
export const checkSession = (req, res) => {
  // Die `verifyToken` Middleware hat bereits das Cookie überprüft und `req.user` gesetzt.
  // Wenn wir hier ankommen, ist die Session gültig.
  res.status(200).json({
    success: true,
    user: req.user // req.user wird von Ihrer Authentifizierungs-Middleware gesetzt
  });
};


/**
 * Stellt Dashboard-Daten für authentifizierte Benutzer bereit
 * (Diese Funktion bleibt unverändert, da die Middleware die Authentifizierung übernimmt)
 * @param {Request} req - Express Request Objekt mit Benutzerinformationen
 * @param {Response} res - Express Response Objekt
 */
export const getDashboardData = (req, res) => {
  res.json({
    message: `Willkommen, ${req.user.displayName || req.user.username}!`,
    user: req.user,
    status: 'erfolgreich'
  });
};

/**
 * API-Endpoint um Benutzergruppen abzufragen
 * @param {Request} req - Express Request Objekt 
 * @param {Response} res - Express Response Objekt
 */
export const getUserGroups = async (req, res) => {
  try {
    const username = req.user.username;
    
    // Hole aktuelle Benutzerinformationen
    const userInfo = await new Promise((resolve, reject) => {
      ldapAuth.getUserInfo(username, (err, info) => {
        if (err) reject(err);
        else resolve(info);
      });
    });

    // Mappe Rollen
    const roles = mapUserRoles(userInfo.groups);

    res.json({
      username: userInfo.username,
      displayName: userInfo.displayName,
      groups: userInfo.groups,
      roles: roles
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzergruppen:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Gruppeninformationen' });
  }
};

/**
 * API-Endpoint um zu überprüfen, ob ein Benutzer in einer bestimmten Gruppe ist
 * @param {Request} req - Express Request Objekt
 * @param {Response} res - Express Response Objekt
 */
export const checkUserGroup = async (req, res) => {
  try {
    const { groupName } = req.params;
    const username = req.user.username;

    const isMember = await isUserInGroup(username, groupName);
    
    res.json({
      username,
      groupName,
      isMember
    });
  } catch (error) {
    console.error('Fehler beim Überprüfen der Gruppenmitgliedschaft:', error);
    res.status(500).json({ error: 'Fehler beim Überprüfen der Gruppenmitgliedschaft' });
  }
};

/**
 * API-Endpoint um alle verfügbaren Gruppen zu durchsuchen
 * @param {Request} req - Express Request Objekt
 * @param {Response} res - Express Response Objekt
 */
export const searchAvailableGroups = async (req, res) => {
  try {
    // Nur Admins und ITSZ-Mitarbeiter dürfen Gruppen durchsuchen
    if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('itsz')) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Aktion' });
    }

    const { pattern = '*hnee*' } = req.query;
    const groups = await searchGroups(pattern);
    
    res.json({
      pattern,
      groups
    });
  } catch (error) {
    console.error('Fehler beim Durchsuchen der Gruppen:', error);
    res.status(500).json({ error: 'Fehler beim Durchsuchen der Gruppen' });
  }
};