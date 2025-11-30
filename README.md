# Telegram AI Companion - Complete Implementation

A production-ready Telegram AI Companion system built with Next.js and Firebase.

## Features

- **Telegram Userbot**: Appears as a real person (not a bot) using GramJS
- **AI Conversations**: GPT-4o powered with conversation memory
- **Telegram Stars Payments**: Full payment system with invoices
- **Content Delivery**: Secure content delivery after payment
- **Custom Video Generation**: FFmpeg-based video processing with text overlays
- **User Tier System**: Free, Regular, and VIP tiers based on spending
- **Social Media Sync**: Auto-sync Instagram, TikTok, and YouTube content
- **Admin Dashboard**: Complete web interface for content and user management

## Setup Instructions

### 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

Required variables:
- Firebase configuration (from Firebase Console)
- Telegram API credentials (from https://my.telegram.org)
- OpenAI API key
- Admin password hash (generate with bcrypt)
- YouTube API key (optional, for YouTube sync)

### 2. Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Enable Storage
4. Create a service account and download the private key
5. Add the credentials to `.env.local`

### 3. Generate Admin Password Hash

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10).then(hash => console.log(hash))"
```

Add the hash to `ADMIN_PASSWORD_HASH` in `.env.local`

### 4. Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

### 5. Run the Application

**Development Server:**
```bash
npm run dev
```

**Telegram Userbot (separate terminal):**
```bash
npm run telegram
```

**Social Media Sync (separate terminal):**
```bash
npm run social-sync
```

**Video Processor (separate terminal):**
```bash
npm run video-processor
```

## Project Structure

```
├── app/
│   ├── admin/              # Admin dashboard
│   ├── api/                # API routes
│   └── page.js             # Home page
├── components/
│   └── admin/              # Admin components
├── lib/
│   ├── firebase.js         # Firebase client
│   ├── firebase-admin.js   # Firebase admin
│   ├── openai.js           # OpenAI integration
│   ├── telegram-userbot.js # Telegram userbot
│   ├── database.js         # Database operations
│   ├── payments.js         # Payment handling
│   ├── content-delivery.js # Content delivery
│   ├── video-generation.js # Video processing
│   └── social-media-sync.js # Social media sync
├── scripts/
│   ├── start-telegram.js  # Telegram userbot starter
│   ├── social-sync.js     # Social media sync worker
│   └── video-processor.js  # Video processing worker
└── .env.local              # Environment variables
```

## Firebase Collections

- `users` - User data and spending
- `conversations/{userId}/messages` - Conversation history
- `content` - Available content for purchase
- `invoices` - Payment invoices
- `transactions` - Payment transactions
- `social_memories` - Social media content summaries
- `base_videos` - Base videos for custom generation
- `video_queue` - Video processing queue

## Admin Dashboard

Access at `/admin` after starting the dev server.

Features:
- Content Management (upload, edit, delete)
- Analytics (revenue, transactions, user spending)
- User Management (view users, block/unblock)
- Settings (wipe all content)

## Telegram Setup

1. Get API credentials from https://my.telegram.org
2. Add `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` to `.env.local`
3. Add your phone number to `TELEGRAM_PHONE_NUMBER`
4. Run `npm run telegram` and enter verification code when prompted

## Payment System

The system uses Telegram Stars (XTR) for payments:
- 1 Star = $0.01
- Invoices are created automatically
- Payments are processed via webhook
- Content is delivered immediately after payment

## Custom Video Generation

1. Upload base videos via admin dashboard
2. User pays for custom video
3. System randomly selects base video
4. Adds text overlay with user's name
5. Processes and delivers in 15-30 minutes

## Social Media Sync

Runs automatically every hour:
- Fetches new Instagram Stories/Reels
- Fetches new TikTok videos
- Fetches new YouTube videos
- Analyzes with GPT-4o Vision
- Saves summaries to Firebase

## Security

- Content URLs are signed with expiration
- Admin routes are password protected
- Content wipe requires password confirmation
- User data is encrypted in Firebase

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Deploy to Vercel or similar platform

3. Set up cron jobs for:
   - Social media sync (hourly)
   - Video processing (every 5 minutes)

4. Run background services:
   - Telegram userbot (always running)
   - Social media sync worker
   - Video processor worker

## Notes

- The Telegram userbot must run continuously
- FFmpeg must be installed for video generation
- Firebase Storage is used for all media files
- All background workers should run as separate processes

## License

Private - All rights reserved

# telegram-bot
