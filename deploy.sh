#!/bin/bash

# Deployment script for Telegram AI Bot
# This script deploys the bot code to the server (excluding admin-panel)

set -e

# Configuration
SERVER_USER="root"
SERVER_IP="165.22.129.138"
SERVER_SSH_KEY="telgramlab"
SERVER_DIR="/root/telegram-bot"
LOCAL_DIR="."

# Find SSH key (check common locations)
if [ -f "$SERVER_SSH_KEY" ]; then
    SSH_KEY_PATH="$SERVER_SSH_KEY"
elif [ -f "$HOME/.ssh/$SERVER_SSH_KEY" ]; then
    SSH_KEY_PATH="$HOME/.ssh/$SERVER_SSH_KEY"
elif [ -f "$HOME/$SERVER_SSH_KEY" ]; then
    SSH_KEY_PATH="$HOME/$SERVER_SSH_KEY"
elif [ -f "./$SERVER_SSH_KEY" ]; then
    SSH_KEY_PATH="./$SERVER_SSH_KEY"
else
    echo "❌ Error: SSH key '$SERVER_SSH_KEY' not found!"
    echo "   Please provide the full path to your SSH key or place it in ~/.ssh/"
    exit 1
fi

echo "🔑 Using SSH key: $SSH_KEY_PATH"

echo "🚀 Starting deployment to server..."

# Create deployment package (excluding admin-panel and unnecessary files)
echo "📦 Creating deployment package..."

# Create a temporary directory for deployment
TEMP_DIR=$(mktemp -d)
DEPLOY_DIR="$TEMP_DIR/telegram-bot"

mkdir -p "$DEPLOY_DIR"

# Copy files (excluding admin-panel, node_modules, logs, etc.)
echo "📋 Copying files..."

# Copy all files except excluded ones
rsync -av --progress \
  --exclude='admin-panel' \
  --exclude='node_modules' \
  --exclude='logs' \
  --exclude='*.log' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.DS_Store' \
  --exclude='*.zip' \
  --exclude='session.txt' \
  --exclude='bot.log' \
  --exclude='check-bot.js' \
  "$LOCAL_DIR/" "$DEPLOY_DIR/"

# Create .env.example file for reference
cat > "$DEPLOY_DIR/.env.example" << EOF
BOT_TOKEN=your_telegram_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id_here
MINI_APP_URL=https://telegram-page-three.vercel.app
EOF

# Create PM2 ecosystem file
cat > "$DEPLOY_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'telegram-bot',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF

# Create setup script for server
cat > "$DEPLOY_DIR/setup-server.sh" << 'EOF'
#!/bin/bash

set -e

echo "🔧 Setting up Telegram Bot on server..."

# Create logs directory
mkdir -p logs

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Install project dependencies
echo "📦 Installing project dependencies..."
npm install --production

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "❌ IMPORTANT: Please edit .env file and add your API keys:"
    echo "   nano .env"
    echo ""
    echo "Required variables:"
    echo "   - BOT_TOKEN"
    echo "   - OPENAI_API_KEY"
    echo ""
    exit 1
fi

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Edit .env file: nano .env"
echo "   2. Start the bot: pm2 start ecosystem.config.js"
echo "   3. Save PM2 config: pm2 save"
echo "   4. Setup auto-start: pm2 startup"
EOF

chmod +x "$DEPLOY_DIR/setup-server.sh"

# Transfer files to server
echo "📤 Transferring files to server..."
rsync -avz --progress -e "ssh -i $SSH_KEY_PATH" \
  "$DEPLOY_DIR/" "$SERVER_USER@$SERVER_IP:$SERVER_DIR/"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps on server:"
echo "   1. SSH into server: ssh -i $SSH_KEY_PATH $SERVER_USER@$SERVER_IP"
echo "   2. Navigate to: cd $SERVER_DIR"
echo "   3. Run setup: bash setup-server.sh"
echo "   4. Edit .env file: nano .env"
echo "   5. Start bot: pm2 start ecosystem.config.js"
echo "   6. Save PM2: pm2 save && pm2 startup"
