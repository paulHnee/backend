# HNEE Backend – IT-Service Zentrum

Dieses Backend stellt die API und Sicherheitslogik für die Web-Anwendung des IT-Service Zentrums der Hochschule für nachhaltige Entwicklung Eberswalde (HNEE) bereit.

## 🚀 Hauptfunktionen

- 🌐 **VPN-Management** mit rollenbasierten Limits und TOTP/OTP-Schutz
- 🔐 **LDAP-Authentifizierung** für sichere Logins
- 🛡️ **Enterprise-Security**: Rate Limiting, Security Headers, Session Management
- 📊 **Monitoring & Audit-Logging**
- 🖥️ **Integration mit WireGuard und OPNsense**

## 🛠️ Technologie-Stack

- **Node.js** mit **Express.js**
- **LDAP** für Authentifizierung
- **WireGuard** & **OPNsense** API-Integration
- **otplib** & **qrcode** für TOTP/OTP
- **Joi/Zod** für Request-Validation

## 📦 Installation & Setup

1. Repository klonen:

```bash
git clone https://github.com/paulhnee/backend.git
cd backend
```

2. Abhängigkeiten installieren:

```bash
npm install
```

3. Umgebungsvariablen konfigurieren:

```bash
cp .env.example .env
# Passen Sie die LDAP-, VPN- und API-Einstellungen an
```

4. Backend starten:

```bash
npm run start
```

## 🔑 TOTP/OTP für VPN

- Vor dem Erstellen einer VPN-Verbindung muss ein Einmalpasswort (TOTP) aus einer Authenticator-App (z.B. Google Authenticator, Authy) eingegeben und verifiziert werden.
- QR-Code für die Einrichtung wird über die API bereitgestellt (`/api/vpn/totp-setup`).
- TOTP-Validierung erfolgt über `/api/vpn/totp-verify`.
- Relevante Dateien: `utils/otpAuthenticator.js`, `controllers/totpController.js`, `routes/totpRoutes.js`, Integration in `vpnController.js`.

## 📁 Projektstruktur

```
backend/
├── controllers/     # API-Controller (VPN, Auth, TOTP, Monitoring ...)
├── middleware/      # Sicherheits-Middleware (Auth, Security ...)
├── routes/          # API-Routen
├── utils/           # Hilfsfunktionen (LDAP, TOTP, Logging ...)
├── certs/           # TLS-Zertifikate
├── config/          # Konfigurationen (LDAP, OPNsense, Security ...)
├── logs/            # Logdateien
├── test/            # Test-Skripte
└── server.js        # Express-Server Einstiegspunkt
```

## 🔐 Sicherheitsfeatures

- **TOTP/OTP-Validierung** für VPN-Endpunkte
- **LDAP-Authentifizierung** mit Session-Management
- **Rate Limiting** pro IP und Benutzer
- **Request-Validation** mit Joi/Zod
- **Security Headers** (HSTS, X-Frame-Options, CSP, etc.)
- **Audit-Logging** für sicherheitsrelevante Aktionen

## 🧪 Testen

- Test-Skripte im `test/`-Verzeichnis
- Beispiel: `test/test-auth-flow.js`, `test/test-vpn-controller.js`

## 📄 Lizenz

MIT-Lizenz – siehe LICENSE.md

---

*Entwickelt mit ❤️ für die HNEE IT-Service Zentrum*
