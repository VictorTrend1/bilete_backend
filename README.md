# Backend - Site Bilete

Backend API pentru sistemul de gestionare a biletelor.

## Instalare

```bash
npm install
```

## Configurare

Creați un fișier `.env` în directorul backend cu următoarele variabile:

```env
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
MONGODB_URI=mongodb+srv://bilete_bal:gVbOaBkvwv7U718D@cluster0.xgd65qu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

## Rulare

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## API Documentation

### Autentificare

#### POST /api/register
Înregistrare utilizator nou.

**Body:**
```json
{
  "username": "string",
  "email": "string", 
  "password": "string"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "token": "jwt-token",
  "user": {
    "id": 1,
    "username": "string",
    "email": "string"
  }
}
```

#### POST /api/login
Conectare utilizator.

**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt-token",
  "user": {
    "id": 1,
    "username": "string",
    "email": "string"
  }
}
```

### Bilete

#### POST /api/tickets
Creare bilet nou (necesită autentificare).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Body:**
```json
{
  "nume": "string",
  "telefon": "string",
  "tip_bilet": "BAL + AFTER" | "BAL" | "AFTER" | "AFTER VIP" | "BAL + AFTER VIP"
}
```

**Response:**
```json
{
  "message": "Ticket created successfully",
  "ticket": {
    "id": 1,
    "nume": "string",
    "telefon": "string",
    "tip_bilet": "string",
    "qr_code": "data:image/png;base64,..."
  }
}
```

#### GET /api/tickets
Obținere bilete utilizator (necesită autentificare).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "tickets": [
    {
      "id": 1,
      "nume": "string",
      "telefon": "string",
      "tip_bilet": "string",
      "qr_code": "json-string",
      "created_at": "2024-01-01T00:00:00.000Z",
      "verified": false
    }
  ]
}
```

#### POST /api/verify-ticket
Verificare bilet prin QR code.

**Body:**
```json
{
  "qrData": "json-string"
}
```

**Response:**
```json
{
  "message": "Ticket verified successfully",
  "ticket": {
    "id": 1,
    "nume": "string",
    "telefon": "string",
    "tip_bilet": "string",
    "verified": true,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Admin

#### GET /api/admin/tickets
Obținere toate biletele (necesită autentificare).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "tickets": [
    {
      "id": 1,
      "user_id": 1,
      "nume": "string",
      "telefon": "string",
      "tip_bilet": "string",
      "qr_code": "json-string",
      "created_at": "2024-01-01T00:00:00.000Z",
      "verified": false,
      "username": "string"
    }
  ]
}
```

## Baza de Date

Sistemul folosește MongoDB (Mongoose) cu următoarele colecții:

### users
- `username` String, unique, required
- `email` String, unique, required
- `password` String, required (bcrypt hashed)
- `created_at` Date (automat)

### tickets
- `user_id` ObjectId referință către `users`, required
- `nume` String, required
- `telefon` String, required
- `tip_bilet` String, required (enum: BAL + AFTER | BAL | AFTER | AFTER VIP | BAL + AFTER VIP)
- `qr_code` String, unique, required (JSON string)
- `verified` Boolean (default false)
- `created_at` Date (automat)

## Dependențe

- **express**: Framework web
- **cors**: Cross-Origin Resource Sharing
- **bcryptjs**: Criptare parole
- **jsonwebtoken**: Autentificare JWT
- **mongoose**: ODM pentru MongoDB
- **qrcode**: Generare QR code-uri
- **dotenv**: Variabile de mediu

## Securitate

- Parolele sunt criptate cu bcrypt (salt rounds: 10)
- Autentificare JWT cu expirare (24 ore)
- Validare input pe toate endpoint-urile
- CORS configurat pentru frontend
- Middleware de autentificare pentru rute protejate
