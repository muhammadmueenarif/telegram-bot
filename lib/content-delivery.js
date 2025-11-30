import { adminStorage } from './firebase-admin.js'
import { getContentById, addPurchasedContent } from './database.js'
import { sendMessage } from './telegram-userbot.js'

export async function sendContentAfterPayment(userId, contentId) {
  const content = await getContentById(contentId)
  if (!content) {
    await sendMessage(userId, "Sorry, the content you purchased is no longer available.")
    return
  }

  // Generate signed URL
  const fileRef = adminStorage.bucket().file(content.storagePath)
  const [signedUrl] = await fileRef.getSignedUrl({
    action: 'read',
    expires: '03-01-2500', // Long expiration
  })

  // Send content based on type
  if (content.type === 'photo') {
    await sendMessage(userId, {
      message: content.caption || "Here's your exclusive content! 💕",
      file: signedUrl,
    })
  } else if (content.type === 'video') {
    await sendMessage(userId, {
      message: content.caption || "Here's your exclusive video! 💕",
      file: signedUrl,
    })
  }

  // Mark as purchased
  await addPurchasedContent(userId, contentId, content.type)
}

export async function generateSignedUrl(storagePath, expiresInHours = 24) {
  const fileRef = adminStorage.bucket().file(storagePath)
  const expires = new Date()
  expires.setHours(expires.getHours() + expiresInHours)

  const [signedUrl] = await fileRef.getSignedUrl({
    action: 'read',
    expires,
  })

  return signedUrl
}

