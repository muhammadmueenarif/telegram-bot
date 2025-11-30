import dotenv from 'dotenv'
import { adminDb } from '../lib/firebase-admin.js'
import { generateCustomVideo } from '../lib/video-generation.js'

dotenv.config({ path: '.env.local' })

async function processVideoQueue() {
  const queue = await adminDb.collection('video_queue')
    .where('status', '==', 'pending')
    .limit(5)
    .get()

  for (const doc of queue.docs) {
    const job = doc.data()
    try {
      await generateCustomVideo(job.userId, job.userName)
    } catch (error) {
      console.error(`Error processing video for user ${job.userId}:`, error)
      await adminDb.collection('video_queue').doc(doc.id).update({
        status: 'failed',
        error: error.message,
      })
    }
  }
}

// Check queue every 5 minutes
setInterval(processVideoQueue, 5 * 60 * 1000)
processVideoQueue() // Run immediately

console.log('Video processor started. Checking queue every 5 minutes.')

