# CORS und HTTPS-Redirect Fixes

## ❌ Ursprüngliches Problem

```
Failed to load resource: Cross-origin redirection to https://10.1.1.45:5000/api/session denied by Cross-Origin Resource Sharing policy: Origin http://10.1.1.45 is not allowed by Access-Control-Allow-Origin. Status code: 301
```

## 🔍 Ursachen identifiziert

1. **CORS-Konfiguration zu restriktiv**
   - Nur `http://10.1.1.45` erlaubt (ohne Port)
   - Frontend läuft auf `http://10.1.1.45:8080`

2. **HSTS aktiviert** 
   - HTTP Strict Transport Security erzwingt HTTPS-Redirect
   - Status Code 301 (Permanent Redirect)

## 🛠️ Durchgeführte Fixes

### Fix 1: CORS Origins erweitert

**Datei:** `backend/config/cors.js`

```javascript
const allowedOrigins = [
  // Frontend URLs (mit und ohne Port)
  process.env.FRONTEND_URL || 'http://10.1.1.45',
  'http://10.1.1.45:8080',  // Frontend Dev Server
  'http://10.1.1.45:3000',  // Alternative Frontend Port
  'http://10.1.1.45:5173',  // Vite Dev Server
  'http://localhost:8080',  // Local Frontend
  'http://localhost:3000',  // Local Development
  'http://localhost:5173',  // Local Vite
];

// Allow requests with no origin (mobile apps, curl, Postman, etc.)
if (!origin) {
  return callback(null, true);
}
```

### Fix 2: HSTS deaktiviert

**Datei:** `backend/config/securityHeaders.js`

```javascript
// Strict Transport Security (disabled for HTTP setup)
hsts: false,
```

### Fix 3: Server.js repariert

**Änderungen:**
- Unicode-Zeichen-Probleme in Console-Logs behoben
- HTTPS-Enforcement Status im Health Check hinzugefügt
- Bessere Logging-Ausgabe

## ✅ Erwartete Resultate

### CORS Headers
```
Access-Control-Allow-Origin: http://10.1.1.45:8080
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

### Keine HTTPS-Redirects mehr
- Status Code: **200** (statt 301)
- Keine automatischen HTTPS-Weiterleitungen
- HTTP-Requests werden direkt verarbeitet

### Console-Output
```
🚀 HNEE Server läuft auf Port 5000 (Umgebung: production)
📡 Protokoll: HTTP (HTTPS-Redirect deaktiviert)
🔒 Sicherheitsfeatures aktiv: Rate Limiting, Input Validation, Security Headers
📊 Health Check: http://localhost:5000/api/health
🌐 CORS Origins: Frontend auf verschiedenen Ports erlaubt
```

## 🧪 Test-Befehle

### CORS-Test
```bash
curl -H "Origin: http://10.1.1.45:8080" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     http://10.1.1.45:5000/api/session
```

### Health Check
```bash
curl http://10.1.1.45:5000/api/health
```

## 🔄 Frontend-Integration

Das Frontend sollte jetzt erfolgreich API-Aufrufe machen können:

```javascript
// Axios-Request vom Frontend (http://10.1.1.45:8080)
axios.get('http://10.1.1.45:5000/api/session', {
  withCredentials: true
});
```

## 📋 Debugging-Hinweise

### Bei weiteren CORS-Problemen:
1. Browser DevTools → Network Tab prüfen
2. Preflight OPTIONS-Request prüfen
3. Backend-Logs für CORS-Warnings überprüfen

### Backend-Logs überwachen:
```bash
# Backend-Logs in Echtzeit
tail -f /path/to/backend/logs
```

Die Logs zeigen jetzt bei unerlaubten Origins:
```
CORS request from unauthorized origin: http://example.com
Allowed origins: [http://10.1.1.45, http://10.1.1.45:8080, ...]
```
