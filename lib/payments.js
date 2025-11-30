import { adminDb } from './firebase-admin.js'
import { updateUserSpending, addPurchasedContent } from './database.js'
import { sendContentAfterPayment } from './content-delivery.js'
import { client } from './telegram-userbot.js'
import { generateCustomVideo } from './video-generation.js'

export async function createInvoice(userId, title, amount, type, contentId = null) {
  const invoice = {
    userId,
    title,
    amount, // in stars (1 star = $0.01)
    type, // 'content' or 'subscription' or 'custom_video'
    contentId,
    status: 'pending',
    createdAt: new Date(),
  }

  const doc = await adminDb.collection('invoices').add(invoice)
  invoice.id = doc.id

  return invoice
}

export async function handlePreCheckout(query) {
  const invoiceId = query.invoice_payload
  const invoiceDoc = await adminDb.collection('invoices').doc(invoiceId).get()
  
  if (!invoiceDoc.exists) {
    return false
  }

  const invoice = invoiceDoc.data()
  if (invoice.status !== 'pending') {
    return false
  }

  // Verify amount matches
  if (query.total_amount !== invoice.amount) {
    return false
  }

  return true
}

export async function handleSuccessfulPayment(payment) {
  const invoiceId = payment.invoice_payload
  const invoiceDoc = await adminDb.collection('invoices').doc(invoiceId).get()
  
  if (!invoiceDoc.exists) {
    return
  }

  const invoice = invoiceDoc.data()
  const userId = payment.from.id.toString()
  const amount = payment.total_amount / 100 // Convert to dollars

  // Update invoice status
  await adminDb.collection('invoices').doc(invoiceId).update({
    status: 'completed',
    completedAt: new Date(),
    paymentId: payment.telegram_payment_charge_id,
  })

  // Record transaction
  await adminDb.collection('transactions').add({
    userId,
    invoiceId,
    amount,
    type: invoice.type,
    contentId: invoice.contentId,
    timestamp: new Date(),
  })

  // Update user spending
  await updateUserSpending(userId, amount)

  // Handle content delivery
  if (invoice.type === 'content' && invoice.contentId) {
    await sendContentAfterPayment(userId, invoice.contentId)
  } else if (invoice.type === 'custom_video') {
    await initiateCustomVideoGeneration(userId, payment.from.first_name)
  } else if (invoice.type === 'subscription') {
    if (client) {
      await client.sendMessage(userId, {
        message: "🎉 Welcome to VIP! You now have access to exclusive content and special perks!",
      })
    }
  }
}

async function initiateCustomVideoGeneration(userId, userName) {
  // Add to processing queue
  await adminDb.collection('video_queue').add({
    userId,
    userName,
    status: 'pending',
    createdAt: new Date(),
  })

  if (client) {
    await client.sendMessage(userId, {
      message: "✨ Your custom video is being created! It will be ready in 15-30 minutes. I'll send it to you as soon as it's done!",
    })
  }
}

async function processCustomVideo(userId, userName) {
  // This will be handled by the video processor background worker
  // The queue entry is already created, the worker will pick it up
}

