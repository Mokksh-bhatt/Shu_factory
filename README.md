# Shon Ceramics Command Center

Production-ready task and communication app for factory owner/admin and workers.

## Core Features

- Owner/admin login via Firebase Authentication (email/password)
- Worker login only through admin-created accounts
- Worker passwords stored as PBKDF2 hashes (no plaintext)
- Task assignment, task response, and worker photo attachment responses
- Owner task/chat filters with date markers
- Multi-language support (English, Hindi, Gujarati)
- PWA support (manifest + service worker)

## Production Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Update `.env`:

```env
VITE_OWNER_EMAIL=your-owner-email@example.com
VITE_REQUIRE_OWNER_CLAIM=false
```

- Keep `VITE_REQUIRE_OWNER_CLAIM=false` until you configure custom claims.
- Set it to `true` only after running claim setup and confirming admin account has `role=owner`.

4. In Firebase Console:
   - Enable **Authentication > Sign-in method > Email/Password**.
   - Create owner/admin user with the same email as `VITE_OWNER_EMAIL`.
   - Ensure Firestore and Storage rules only allow expected access patterns for your app.

5. Set owner custom claim (`role=owner`) so only owner can use admin actions.

### Set Owner Custom Claim

Use the provided script:

```bash
OWNER_EMAIL=owner@example.com GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/setOwnerClaim.mjs
```

PowerShell example:

```powershell
$env:OWNER_EMAIL="owner@example.com"; $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\service-account.json"; node scripts/setOwnerClaim.mjs
```

After running, sign out and sign back in as owner.

## Rules Deployment

Rules files are included:

- `firestore.rules`
- `storage.rules`

Deploy them with:

```bash
firebase deploy --only firestore:rules,storage
```

## Development

```bash
npm run dev -- --host
```

Local app: `http://localhost:5173`

## Build

```bash
npm run build
```

## Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

## Security Notes

- Do not commit `.env` to source control.
- Owner password is never hardcoded in source.
- Worker passwords are hashed client-side before storing.
- Input lengths and file upload type/size are validated in app logic.
