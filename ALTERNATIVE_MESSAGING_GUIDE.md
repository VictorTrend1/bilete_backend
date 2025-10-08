# Ghid pentru Servicii Alternative de Mesagerie

Acest ghid explică cum să configurați și să folosiți serviciile alternative de mesagerie pentru a trimite biletele automat, fără să depindeți de Meta API.

## 🚀 Opțiuni Disponibile

### 1. **SMS prin Twilio** (Recomandat)
- ✅ Cel mai fiabil și rapid
- ✅ Funcționează în toate țările
- ✅ Rate limits mari
- ✅ Cost mic per mesaj

### 2. **Email** (Backup)
- ✅ Gratuit
- ✅ Poate include atașamente
- ✅ Funcționează cu orice provider de email

### 3. **Link WhatsApp Web** (Fallback)
- ✅ Gratuit
- ✅ Nu necesită configurare
- ✅ Funcționează întotdeauna

## 📋 Configurare

### Opțiunea 1: SMS prin Twilio (Recomandat)

1. **Creați cont Twilio:**
   - Mergeți la [twilio.com](https://www.twilio.com)
   - Creați un cont gratuit
   - Verificați numărul de telefon

2. **Obțineți credențialele:**
   ```env
   TWILIO_ACCOUNT_SID=your_account_sid_here
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_FROM_NUMBER=+1234567890
   ```

3. **Adăugați în .env:**
   ```env
   # Twilio SMS Configuration
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_FROM_NUMBER=+1234567890
   ```

### Opțiunea 2: Email

1. **Configurați Gmail (sau alt provider):**
   ```env
   # Email Configuration
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

2. **Pentru Gmail, folosiți App Password:**
   - Mergeți la Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generați o parolă pentru aplicație

### Opțiunea 3: WhatsApp Web Link (Automat)

Nu necesită configurare - funcționează automat ca fallback.

## 🛠️ Instalare

1. **Instalați dependențele:**
   ```bash
   npm install nodemailer
   ```

2. **Configurați variabilele de mediu:**
   ```bash
   cp .env.example .env
   # Editați .env cu credențialele voastre
   ```

3. **Porniți serverul:**
   ```bash
   npm start
   ```

## 📱 Cum Funcționează

### Trimite Bilet Individual
```javascript
POST /api/bot/send-ticket
{
  "ticketId": "ticket_id_here",
  "phoneNumber": "0712345678",
  "email": "user@example.com", // opțional
  "customImagePath": "/path/to/image.jpg" // opțional
}
```

### Trimite Bilete în Masă
```javascript
POST /api/bot/send-bulk-tickets
{
  "ticketIds": ["id1", "id2", "id3"],
  "phoneNumbers": ["0712345678", "0798765432", "0755555555"],
  "emails": ["user1@example.com", "user2@example.com", "user3@example.com"], // opțional
  "customImagePaths": ["/path1.jpg", "/path2.jpg", "/path3.jpg"] // opțional
}
```

### Programează Trimitere
```javascript
POST /api/bot/schedule-ticket
{
  "ticketId": "ticket_id_here",
  "phoneNumber": "0712345678",
  "email": "user@example.com", // opțional
  "sendTime": "2024-12-25 10:00:00",
  "customImagePath": "/path/to/image.jpg" // opțional
}
```

## 🎯 Strategia de Trimitere

Serviciul încearcă să trimită prin următoarea ordine:

1. **SMS (Twilio)** - dacă este configurat
2. **Email** - dacă este furnizat și configurat
3. **Link WhatsApp Web** - întotdeauna ca fallback

### Exemplu de Răspuns
```json
{
  "success": true,
  "message": "Ticket sending attempted with multiple methods",
  "result": {
    "success": true,
    "message": "Ticket sending attempted with multiple methods",
    "results": [
      {
        "success": true,
        "method": "SMS",
        "data": { "sid": "SM1234567890" }
      },
      {
        "success": true,
        "method": "WhatsApp_Web_Link",
        "link": "https://wa.me/40712345678?text=...",
        "message": "Click the link to open WhatsApp Web and send the message"
      }
    ],
    "primaryMethod": "SMS"
  }
}
```

## 💰 Costuri

### Twilio SMS
- **Gratuit**: $15 credit la înregistrare
- **SMS România**: ~$0.05 per mesaj
- **SMS Internațional**: ~$0.10-0.20 per mesaj

### Email
- **Gratuit**: cu Gmail/Outlook
- **Limite**: 500 mesaje/zi (Gmail)

### WhatsApp Web Link
- **Gratuit**: complet
- **Limitare**: utilizatorul trebuie să facă click manual

## 🔧 Configurare Avansată

### Rate Limiting
```javascript
// În alternativeMessagingService.js
// Delay între mesaje pentru a evita rate limiting
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 secundă
```

### Logging
```javascript
// Toate mesajele sunt logate în consolă
console.log(`SMS sent successfully to ${phoneNumber}`);
console.log(`Email sent successfully to ${email}`);
```

### Error Handling
```javascript
// Serviciul încearcă toate metodele disponibile
// Dacă SMS eșuează, încearcă email
// Dacă email eșuează, oferă link WhatsApp
```

## 🚨 Troubleshooting

### SMS nu funcționează
1. Verificați credențialele Twilio
2. Verificați dacă numărul de telefon este valid
3. Verificați creditul Twilio

### Email nu funcționează
1. Verificați credențialele Gmail
2. Folosiți App Password, nu parola normală
3. Verificați dacă 2FA este activat

### Link WhatsApp nu funcționează
1. Verificați formatul numărului de telefon
2. Asigurați-vă că numărul include codul de țară

## 📊 Monitorizare

### Verificați Statusul Serviciului
```bash
curl http://localhost:3001/api/bot/status
```

### Verificați Configurarea
```bash
curl http://localhost:3001/api/bot/config
```

### Debug Informații
```bash
curl http://localhost:3001/api/bot/debug
```

## 🎉 Avantaje

- ✅ **Nu depinde de Meta API**
- ✅ **Funcționează imediat**
- ✅ **Multiple opțiuni de fallback**
- ✅ **Cost mic**
- ✅ **Ușor de configurat**
- ✅ **Rate limits mari**
- ✅ **Suport pentru atașamente**

## 📞 Suport

Pentru probleme sau întrebări:
1. Verificați logurile serverului
2. Testați fiecare serviciu individual
3. Verificați configurarea variabilelor de mediu
4. Consultați documentația Twilio/Gmail
