const jwt = require('jsonwebtoken');

/**
 * Middleware für die JWT (JSON Web Token) Authentifizierung
 * Prüft ob der Request einen gültigen JWT Token enthält
 * 
 * @param {Request} req - Express Request Objekt
 * @param {Response} res - Express Response Objekt 
 * @param {Function} next - Express next Function
 */
module.exports = (req, res, next) => {
  // Extrahiert den Token aus dem Authorization Header
  // Entfernt das "Bearer " Prefix falls vorhanden
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  // Wenn kein Token vorhanden ist, wird ein 401 Unauthorized zurückgegeben
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    // Verifiziert den Token mit dem JWT Secret
    // Wirft eine Exception wenn der Token ungültig ist
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fügt die dekodierten User-Informationen zum Request Objekt hinzu
    req.user = decoded;
    
    // Ruft den nächsten Middleware/Route Handler auf
    next();
  } catch (ex) {
    // Bei ungültigem Token wird ein 400 Bad Request zurückgegeben
    res.status(400).json({ error: 'Invalid token' });
  }
};