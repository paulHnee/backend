import jwt from 'jsonwebtoken';
import ldapAuth from '../config/ldap.js';

/**
 * Behandelt Login-Anfragen mit LDAP-Authentifizierung
 * 
 * @param {Request} req - Express Request Objekt mit username und password im Body
 * @param {Response} res - Express Response Objekt
 */
export const login = async (req, res) => {
  console.log('Login-Versuch empfangen');
  const { username, password } = req.body;
  console.log('Empfangener Benutzername:', username);
  // Vorsicht beim Loggen von Passwörtern in Produktionsumgebungen
  // Für Debug-Zwecke loggen wir nur ob ein Passwort vorhanden ist
  console.log('Passwort empfangen (vorhanden):', password ? 'Ja' : 'Nein');

  try {
    // LDAP-Authentifizierung als Promise
    await new Promise((resolve, reject) => {
      ldapAuth.authenticate(username, password, (err, user) => {
        if (err) {
          console.error('LDAP-Authentifizierungsfehler für Benutzer:', username, 'Fehler:', err);
          return reject(err);
        }
        if (!user) {
          // Dieser Fall zeigt an, dass der Benutzer nicht gefunden wurde oder das Passwort falsch ist
          console.error('LDAP-Authentifizierung fehlgeschlagen für Benutzer:', username, 'Benutzer nicht gefunden oder ungültige Anmeldedaten.');
          return reject(new Error('Authentifizierung fehlgeschlagen: Benutzer nicht gefunden oder ungültige Anmeldedaten'));
        }
        console.log('LDAP-Authentifizierung erfolgreich für Benutzer:', username, 'Benutzerdetails:', user);
        resolve(user); // Erfolgreich mit Benutzerobjekt auflösen
      });
    });
    
    // JWT Token generieren mit 1 Stunde Gültigkeit
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });

    // Token an Client senden
    res.json({ token });
  } catch (error) {
    console.error('LDAP-Authentifizierungsverarbeitung fehlgeschlagen für Benutzer:', username, 'Fehler:', error);
    res.status(401).json({ error: 'Authentifizierung fehlgeschlagen', details: error.message });
  }
};

/**
 * Stellt Dashboard-Daten für authentifizierte Benutzer bereit
 * 
 * @param {Request} req - Express Request Objekt mit Benutzerinformationen
 * @param {Response} res - Express Response Objekt
 */
export const getDashboardData = (req, res) => {
  res.json({
    message: `Willkommen, ${req.user.username}!`,
    status: 'erfolgreich'
  });
};