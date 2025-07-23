import jwt from 'jsonwebtoken';
import ldapAuth from '../config/ldap.js';

/**
 * Behandelt Login-Anfragen mit LDAP-Authentifizierung und setzt ein HttpOnly-Cookie.
 * @param {Request} req - Express Request Objekt
 * @param {Response} res - Express Response Objekt
 */
export const login = async (req, res) => {
  const { username, password } = req.body;
  console.log('Login-Versuch empfangen für:', username);

  try {
    // LDAP-Authentifizierung (Ihre Logik bleibt hier gleich)
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

    // JWT Token generieren
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: '1d' // Gültigkeit auf 1 Tag setzen
    });

    // ANSTATT den Token im Body zu senden, setzen wir ein sicheres HttpOnly-Cookie.
    res.cookie('session_token', token, {
      httpOnly: true, // Verhindert den Zugriff über JavaScript im Browser
      secure: process.env.NODE_ENV === 'production', // Cookie nur über HTTPS senden
      sameSite: 'strict', // Schutz gegen CSRF-Angriffe
      maxAge: 24 * 60 * 60 * 1000 // 1 Tag in Millisekunden
    });

    // Sende eine Erfolgsmeldung und Benutzerdaten zurück (ohne Token)
    res.status(200).json({
      success: true,
      user: { username }
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
    message: `Willkommen, ${req.user.username}!`,
    status: 'erfolgreich'
  });
};