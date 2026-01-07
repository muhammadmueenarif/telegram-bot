# Quick Deployment Guide

## One-Command Deployment

Run this from your local machine:

```bash
./deploy.sh
```

Then SSH into your server and run:

```bash
ssh -i telgramlab root@165.22.129.138
cd /root/telegram-bot
bash setup-server.sh
nano .env  # Add your API keys
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## What Gets Deployed

✅ **Included:**
- All bot code (index.js, bot.js, handlers, services, utils)
- package.json and dependencies
- ring.mp3 audio file
- PM2 configuration
- Setup scripts

❌ **Excluded:**
- admin-panel/ directory
- node_modules/
- logs/
- .env file (you'll create this on server)
- .git/
- Temporary files

## Server Requirements

- Ubuntu 24.04 (you have this)
- Node.js 18+ (will be installed automatically)
- PM2 (will be installed automatically)

## Environment Variables Needed

Create `.env` file on server with:

```
BOT_TOKEN=your_bot_token_from_botfather
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=optional
ELEVENLABS_VOICE_ID=optional
MINI_APP_URL=https://telegram-page-three.vercel.app
```

## Troubleshooting

**If deploy.sh fails:**
- Make sure SSH key `telgramlab` is in `~/.ssh/` or provide full path
- Check SSH connection: `ssh -i telgramlab root@165.22.129.138`

**If bot won't start:**
- Check `.env` file exists and has correct values
- Check logs: `pm2 logs telegram-bot`
- Verify Node.js: `node --version`

**To update bot:**
- Run `./deploy.sh` again
- On server: `pm2 restart telegram-bot`

