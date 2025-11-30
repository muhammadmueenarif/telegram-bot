# Complete Setup Guide

## Step 1: Environment Variables

1. Copy `.env.local.example` to `.env.local`
2. Fill in all required values:

### Firebase Setup
1. Go to https://console.firebase.google.com
2. Create a new project
3. Enable Firestore Database (start in production mode)
4. Enable Storage
5. Go to Project Settings > Service Accounts
6. Generate new private key (download JSON)
7. Copy values from JSON to `.env.local`:
   - `FIREBASE_ADMIN_CLIENT_EMAIL` = client_email from JSON
   - `FIREBASE_ADMIN_PRIVATE_KEY` = private_key from JSON (keep the \n characters)
8. Copy Firebase config values to `.env.local`:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

### Telegram Setup
1. Go to https://my.telegram.org
2. Log in with your phone number
3. Go to API Development Tools
4. Create an application
5. Copy `api_id` and `api_hash` to `.env.local`:
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
6. Add your phone number:
   - `TELEGRAM_PHONE_NUMBER` (with country code, e.g., +1234567890)

### OpenAI Setup
1. Go to https://platform.openai.com
2. Create an API key
3. Add to `.env.local`:
   - `OPENAI_API_KEY`

### Admin Password
Generate a password hash:
```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-secure-password', 10).then(hash => console.log(hash))"
```
Add to `.env.local`:
- `ADMIN_PASSWORD_HASH` = the hash output
- `JWT_SECRET` = any random string (for JWT tokens)

### Optional: YouTube Sync
1. Go to https://console.cloud.google.com
2. Enable YouTube Data API v3
3. Create API key
4. Add to `.env.local`:
   - `YOUTUBE_API_KEY`
   - `YOUTUBE_CHANNEL_ID`

### Cron Secret
Add a random string to `.env.local`:
- `CRON_SECRET` = any random string

## Step 2: Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to PATH

## Step 3: Deploy Firebase Rules

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login:
```bash
firebase login
```

3. Initialize (if not already):
```bash
firebase init firestore
firebase init storage
```

4. Deploy rules:
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

## Step 4: First-Time Telegram Authentication

1. Start the Telegram userbot:
```bash
npm run telegram
```

2. Enter the verification code sent to your Telegram
3. If you have 2FA, enter your password
4. The session will be saved automatically

## Step 5: Start All Services

**Terminal 1 - Next.js App:**
```bash
npm run dev
```

**Terminal 2 - Telegram Userbot:**
```bash
npm run telegram
```

**Terminal 3 - Social Media Sync:**
```bash
npm run social-sync
```

**Terminal 4 - Video Processor:**
```bash
npm run video-processor
```

## Step 6: Access Admin Dashboard

1. Open http://localhost:3000/admin
2. Login with the password you hashed earlier
3. Start uploading content!

## Production Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

### Background Workers

For production, you need to run these as separate services:

1. **Telegram Userbot** - Run on a VPS or always-on server
2. **Social Media Sync** - Set up cron job or use Vercel Cron
3. **Video Processor** - Run on a VPS with FFmpeg installed

### Vercel Cron Jobs

Add `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/social-sync",
    "schedule": "0 * * * *"
  }]
}
```

## Troubleshooting

### Telegram Connection Issues
- Make sure API ID and Hash are correct
- Check phone number format (include country code)
- Verify internet connection

### Firebase Errors
- Check service account credentials
- Verify Firestore and Storage are enabled
- Check security rules are deployed

### Video Generation Fails
- Verify FFmpeg is installed: `ffmpeg -version`
- Check base videos are uploaded in admin dashboard
- Check Firebase Storage permissions

### OpenAI Errors
- Verify API key is valid
- Check API quota/limits
- Ensure GPT-4o access is enabled

## Next Steps

1. Upload base videos for custom video generation
2. Upload content via admin dashboard
3. Test payment flow with Telegram Stars
4. Configure social media sync sources
5. Customize AI personality in `lib/openai.js`

