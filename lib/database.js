import { adminDb } from './firebase-admin.js'
import admin from 'firebase-admin'

export function getUserTier(totalSpent) {
  if (totalSpent === 0) return 'free'
  if (totalSpent < 100) return 'regular'
  return 'vip'
}

export async function getUserData(userId) {
  const doc = await adminDb.collection('users').doc(userId).get()
  if (!doc.exists) {
    // Create new user
    await adminDb.collection('users').doc(userId).set({
      userId,
      totalSpent: 0,
      tier: 'free',
      createdAt: new Date(),
      purchasedContent: [],
    })
    return { userId, totalSpent: 0, tier: 'free', purchasedContent: [] }
  }
  return { userId, ...doc.data() }
}

export async function updateUserSpending(userId, amount) {
  const userData = await getUserData(userId)
  const newTotal = (userData.totalSpent || 0) + amount
  const newTier = getUserTier(newTotal)

  await adminDb.collection('users').doc(userId).update({
    totalSpent: newTotal,
    tier: newTier,
    lastPurchase: new Date(),
  })

  return { totalSpent: newTotal, tier: newTier }
}

export async function getConversationHistory(userId, limit = 20) {
  const snapshot = await adminDb.collection('conversations')
    .doc(userId)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get()

  return snapshot.docs
    .map(doc => doc.data())
    .reverse()
}

export async function saveMessage(userId, role, content) {
  await adminDb.collection('conversations')
    .doc(userId)
    .collection('messages')
    .add({
      role,
      content,
      timestamp: new Date(),
    })
}

export async function addPurchasedContent(userId, contentId, contentType) {
  await adminDb.collection('users').doc(userId).update({
    purchasedContent: admin.firestore.FieldValue.arrayUnion({
      contentId,
      contentType,
      purchasedAt: new Date(),
    }),
  })
}

export async function saveSocialMemory(platform, url, summary, metadata) {
  await adminDb.collection('social_memories').add({
    platform,
    url,
    summary,
    metadata,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  })
}

export async function getAllContent() {
  const snapshot = await adminDb.collection('content').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function getContentById(contentId) {
  const doc = await adminDb.collection('content').doc(contentId).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() }
}

export async function createContent(contentData) {
  const doc = await adminDb.collection('content').add({
    ...contentData,
    createdAt: new Date(),
  })
  return doc.id
}

export async function updateContent(contentId, updates) {
  await adminDb.collection('content').doc(contentId).update(updates)
}

export async function deleteContent(contentId) {
  await adminDb.collection('content').doc(contentId).delete()
}

export async function getAllUsers() {
  const snapshot = await adminDb.collection('users').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function getTransactions(startDate, endDate) {
  let query = adminDb.collection('transactions')
  
  if (startDate) {
    query = query.where('timestamp', '>=', startDate)
  }
  if (endDate) {
    query = query.where('timestamp', '<=', endDate)
  }
  
  const snapshot = await query.orderBy('timestamp', 'desc').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

