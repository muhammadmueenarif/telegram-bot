import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage } from 'telegram/events'
import { adminDb } from './firebase-admin.js'
import { getAIResponse } from './openai.js'
import { getUserTier, updateUserSpending, getConversationHistory, saveMessage } from './database.js'
import { createInvoice, handlePayment } from './payments.js'
import { sendContentAfterPayment } from './content-delivery.js'

let client = null
let isConnected = false

export async function initializeTelegramClient() {
  if (isConnected && client) {
    return client
  }

  const apiId = parseInt(process.env.TELEGRAM_API_ID)
  const apiHash = process.env.TELEGRAM_API_HASH
  const stringSession = new StringSession('') // Will be saved after first auth

  client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  })

  await client.start({
    phoneNumber: process.env.TELEGRAM_PHONE_NUMBER,
    password: async () => {
      // Handle 2FA if needed
      return process.env.TELEGRAM_2FA_PASSWORD || ''
    },
    phoneCode: async () => {
      // This will be handled during first-time setup
      return process.env.TELEGRAM_VERIFICATION_CODE || ''
    },
    onError: (err) => console.error('Telegram Auth Error:', err),
  })

  // Save session string
  const sessionString = client.session.save()
  await adminDb.collection('config').doc('telegram_session').set({ session: sessionString })

  isConnected = true

  // Set up message handler
  client.addEventHandler(handleIncomingMessage, new NewMessage({}))

  console.log('Telegram client connected and ready')
  return client
}

async function handleIncomingMessage(event) {
  const message = event.message
  if (!message || !message.text) return

  const senderId = message.senderId?.toString()
  const chatId = message.chatId?.toString()
  const text = message.text

  if (!senderId || !chatId) return

  try {
    // Show typing indicator
    await client.sendMessage(chatId, { action: 'typing' })

    // Get user data
    const userData = await adminDb.collection('users').doc(senderId).get()
    const userSpending = userData.exists ? userData.data().totalSpent || 0 : 0
    const userTier = getUserTier(userSpending)

    // Get conversation history
    const history = await getConversationHistory(senderId)
    const messages = history.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))

    // Add current message
    messages.push({ role: 'user', content: text })
    await saveMessage(senderId, 'user', text)

    // Get social media memories
    const socialMemories = await getSocialMemories()

    // Get AI response
    const aiResponse = await getAIResponse(messages, userTier, userSpending, socialMemories)

    // Save AI response
    await saveMessage(senderId, 'assistant', aiResponse)

    // Send response
    await client.sendMessage(chatId, { message: aiResponse })

    // Check if free user needs subscription offer
    if (userTier === 'free') {
      const messageCount = messages.filter(m => m.role === 'user').length
      if (messageCount >= 10 && messageCount % 10 === 0) {
        await offerSubscription(chatId, senderId)
      }
    }

  } catch (error) {
    console.error('Error handling message:', error)
    await client.sendMessage(chatId, { message: "Sorry, something went wrong. Please try again." })
  }
}

async function offerSubscription(chatId, userId) {
  const invoice = await createInvoice(userId, 'VIP Subscription', 10000, 'subscription') // 100 stars = $1
  await client.sendMessage(chatId, {
    message: "💎 Want exclusive content and VIP treatment? Subscribe now!",
    buttons: [[{ text: 'Subscribe (100 Stars)', data: `pay:${invoice.id}` }]],
  })
}

async function getSocialMemories() {
  const snapshot = await adminDb.collection('social_memories')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get()
  
  return snapshot.docs.map(doc => doc.data())
}

export async function sendTypingIndicator(chatId) {
  if (client && isConnected) {
    await client.sendMessage(chatId, { action: 'typing' })
  }
}

export async function sendMessage(chatId, message, options = {}) {
  if (client && isConnected) {
    await client.sendMessage(chatId, { message, ...options })
  }
}

export { client }

