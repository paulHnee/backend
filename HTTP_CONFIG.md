# HTTP vs HTTPS Konfiguration

## 🔧 Aktuelle Konfiguration: HTTP

Der Server läuft derzeit über **HTTP** ohne automatische HTTPS-Weiterleitung.

### ⚙️ Vorgenommene Änderungen

```javascript
// HTTPS-Forcing deaktiviert in server.js
// app.use(forceHTTPS);  // Auskommentiert
```

### 📡 Server-Status

- **Protokoll:** HTTP  
- **Port:** 5000  
- **HTTPS-Redirect:** ❌ Deaktiviert  
- **Sicherheitsfeatures:** ✅ Aktiv (außer HTTPS-Forcing)

### 🔄 Für HTTPS später aktivieren

#### Option 1: HTTPS-Forcing wieder aktivieren
```javascript
// In server.js
app.use(forceHTTPS);
```

#### Option 2: Nginx Reverse Proxy (Empfohlen für Production)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 🔒 Sicherheitshinweise

**Aktuell aktive Sicherheitsfeatures:**
- ✅ Rate Limiting
- ✅ Input Validation  
- ✅ Security Headers
- ✅ Request Monitoring
- ✅ Payload Validation
- ❌ HTTPS-Enforcement (deaktiviert)

**Für Production empfohlen:**
- HTTPS über Reverse Proxy (Nginx/Apache)
- SSL-Zertifikate (Let's Encrypt)
- HSTS Headers
- Security Headers anpassen

### 📝 Logs ohne HTTPS-Redirects

Mit deaktiviertem HTTPS-Forcing erhalten Sie keine Warnungen mehr wie:
```
warn: Security Event: HTTP_TO_HTTPS_REDIRECT
```

Stattdessen werden HTTP-Requests direkt verarbeitet.
