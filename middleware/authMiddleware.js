import jwt from 'jsonwebtoken';

/**
 * Middleware zur Überprüfung des JWT aus einem HttpOnly-Cookie.
 * Stellt sicher, dass der Request von einem authentifizierten Benutzer stammt.
 * 
 * @param {Request} req - Express Request Objekt (muss `req.cookies` enthalten)
 * @param {Response} res - Express Response Objekt 
 * @param {Function} next - Express next Function
 */
export const verifyToken = (req, res, next) => {
  // Extrahiere das Token aus dem 'session_token' Cookie.
  // Dies erfordert, dass die 'cookie-parser' Middleware in Ihrer App verwendet wird.
  const token = req.cookies.session_token;

  // Wenn kein Token im Cookie vorhanden ist, wird der Zugriff verweigert.
  if (!token) {
    return res.status(401).json({ error: 'Zugriff verweigert. Kein Session-Cookie vorhanden.' });
  }

  try {
    // Verifiziert den Token mit dem JWT Secret.
    // Wirft eine Exception, wenn der Token ungültig oder abgelaufen ist.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fügt die dekodierten Benutzer-Informationen zum Request-Objekt hinzu.
    // Nachfolgende Controller haben dann Zugriff auf `req.user`.
    req.user = decoded;
    
    // Ruft die nächste Middleware oder den nächsten Route-Handler auf.
    next();
  } catch (error) {
    // Bei einem ungültigen Token wird der Zugriff verweigert.
    console.error("Fehler bei der Token-Verifizierung:", error.message);
    return res.status(401).json({ error: 'Ungültiger oder abgelaufener Token.' });
  }
};