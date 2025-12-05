# Nyla Telegram Bot

A Telegram bot with AI chat capabilities, content management, and payment processing using Telegram Stars.

## Project Structure

```
/
├── index.js                 # Main entry point
├── config.js                # Environment configuration
├── bot.js                   # Bot initialization and setup
├── firebaseConfig.js        # Firebase configuration
├── handlers/                # Message and event handlers
│   ├── startHandler.js      # /start command handler
│   ├── textHandler.js       # Text message handler
│   ├── paymentHandler.js    # Payment processing
│   ├── contentHandler.js    # Content/photo/video requests
│   └── customVideoHandler.js # Custom video requests
├── services/                # Business logic services
│   ├── openaiService.js     # OpenAI API integration
│   ├── firebaseService.js   # Firebase operations
│   └── memoryService.js     # User conversation memory
├── utils/                   # Utility functions and constants
│   ├── constants.js         # App constants and configuration
│   └── helpers.js           # Helper functions
└── admin-panel/            # Next.js admin panel
```

## Features

- 🤖 AI-powered conversations with memory
- 💳 Telegram Stars payment integration
- 📸 Content management (photos/videos)
- 🎥 Custom video requests
- 📊 Real-time chat monitoring
- 🗑️ Chat deletion from admin panel

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```
BOT_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_api_key
```

3. Configure Firebase in `firebaseConfig.js`

4. Start the bot:
```bash
npm start
```

5. Start the admin panel (from admin-panel directory):
```bash
cd admin-panel && npm run dev
```

## Environment Variables

- `BOT_TOKEN`: Telegram Bot API token
- `OPENAI_API_KEY`: OpenAI API key

## Usage

- Start a conversation with the bot using `/start`
- Ask for photos/videos using keywords like "pic", "photo", "video"
- Use "paid content" to trigger payment flows
- Admin panel available at `http://localhost:3000` for content management

## Architecture

The bot is structured using clean architecture principles:

- **Handlers**: Process specific types of messages/events
- **Services**: Encapsulate business logic and external API calls
- **Utils**: Shared utility functions and constants
- **Memory Management**: Intelligent conversation history with token limits
- **Error Handling**: Comprehensive error handling and retry logic