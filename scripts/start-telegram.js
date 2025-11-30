import dotenv from 'dotenv'
import { initializeTelegramClient } from '../lib/telegram-userbot.js'

dotenv.config({ path: '.env.local' })

async function start() {
  try {
    console.log('Starting Telegram userbot...')
    await initializeTelegramClient()
    console.log('Telegram userbot is running!')
  } catch (error) {
    console.error('Failed to start Telegram userbot:', error)
    process.exit(1)
  }
}

start()

