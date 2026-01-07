# Deployment Guide

This guide will help you deploy the Telegram AI Bot to your server.

## Prerequisites

- SSH access to the server (you already have this)
- SSH key file: `telgramlab` (in your `~/.ssh/` directory)
- Server IP: `165.22.129.138`

## Quick Deployment

### Option 1: Using the deployment script (Recommended)

1. Make the script executable:
```bash
chmod +x deploy.sh
```

2. Run the deployment script:
```bash
./deploy.sh
```

3. SSH into the server and complete setup:
```bash
ssh -i ~/.ssh/telgramlab root@165.22.129.138
cd /root/telegram-bot
bash setup-server.sh
```

4. Edit the `.env` file with your API keys:
```bash
nano .env
```

5. Start the bot with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Option 2: Manual deployment

1. **Create a tarball excluding admin-panel:**
```bash
tar --exclude='admin-panel' \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='*.log' \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='.DS_Store' \
    -czf telegram-bot.tar.gz .
```

2. **Transfer to server:**
```bash
scp -i ~/.ssh/telgramlab telegram-bot.tar.gz root@165.22.129.138:/root/
```

3. **SSH into server and extract:**
```bash
ssh -i ~/.ssh/telgramlab root@165.22.129.138
cd /root
mkdir -p telegram-bot
tar -xzf telegram-bot.tar.gz -C telegram-bot
cd telegram-bot
```

4. **Install dependencies and setup:**
```bash
# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install project dependencies
npm install --production
```

5. **Create .env file:**
```bash
nano .env
```

Add your environment variables:
```
BOT_TOKEN=your_telegram_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id_here
MINI_APP_URL=https://telegram-page-three.vercel.app
```

6. **Start the bot:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Managing the Bot

### Check bot status:
```bash
pm2 status
```

### View logs:
```bash
pm2 logs telegram-bot
```

### Restart bot:
```bash
pm2 restart telegram-bot
```

### Stop bot:
```bash
pm2 stop telegram-bot
```

### View real-time logs:
```bash
pm2 logs telegram-bot --lines 100
```

## Troubleshooting

### Bot not starting:
1. Check if .env file exists and has correct values
2. Check logs: `pm2 logs telegram-bot`
3. Verify Node.js version: `node --version` (should be 18+)
4. Check if port is available (not needed for polling mode)

### Bot keeps crashing:
1. Check PM2 logs: `pm2 logs telegram-bot --err`
2. Verify all environment variables are set correctly
3. Check Firebase connection
4. Verify OpenAI API key is valid

### Update the bot:
1. Run `./deploy.sh` again from your local machine
2. On server: `cd /root/telegram-bot && pm2 restart telegram-bot`

## File Structure on Server

```
/root/telegram-bot/
├── index.js
├── bot.js
├── config.js
├── firebaseConfig.js
├── package.json
├── .env (you need to create this)
├── ecosystem.config.js
├── handlers/
├── services/
├── utils/
└── logs/
```

## Security Notes

- Never commit `.env` file to git
- Keep your SSH key secure
- Regularly update dependencies: `npm audit fix`
- Monitor bot logs for any issues
- Use PM2 to ensure bot restarts automatically if it crashes

## Environment Variables

Required:
- `BOT_TOKEN`: Your Telegram bot token from @BotFather
- `OPENAI_API_KEY`: Your OpenAI API key

Optional:
- `ELEVENLABS_API_KEY`: For voice features
- `ELEVENLABS_VOICE_ID`: For voice features
- `MINI_APP_URL`: Your mini app URL

