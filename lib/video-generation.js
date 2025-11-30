import ffmpeg from 'fluent-ffmpeg'
import { adminDb, adminStorage } from './firebase-admin.js'
import { sendMessage } from './telegram-userbot.js'
import fs from 'fs'
import { promisify } from 'util'

const unlink = promisify(fs.unlink)

export async function generateCustomVideo(userId, userName) {
  try {
    // Get random base video from library
    const baseVideos = await getBaseVideos()
    if (baseVideos.length === 0) {
      throw new Error('No base videos available')
    }

    const randomVideo = baseVideos[Math.floor(Math.random() * baseVideos.length)]
    const baseVideoPath = await downloadBaseVideo(randomVideo.storagePath)

    // Generate output path
    const outputPath = `/tmp/custom_${userId}_${Date.now()}.mp4`

    // Add text overlay with user's name
    await new Promise((resolve, reject) => {
      ffmpeg(baseVideoPath)
        .videoFilters([
          {
            filter: 'drawtext',
            options: {
              text: userName,
              fontsize: 48,
              fontcolor: 'white',
              x: '(w-text_w)/2',
              y: 'h-th-60',
              box: 1,
              boxcolor: 'black@0.5',
              boxborderw: 5,
            },
          },
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath)
    })

    // Upload to Firebase Storage
    const storagePath = `custom_videos/${userId}/${Date.now()}.mp4`
    await adminStorage.bucket().upload(outputPath, {
      destination: storagePath,
      metadata: {
        contentType: 'video/mp4',
      },
    })

    // Get signed URL
    const fileRef = adminStorage.bucket().file(storagePath)
    const [signedUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-01-2500',
    })

    // Send to user
    await sendMessage(userId, {
      message: `✨ Your custom video is ready, ${userName}! 💕`,
      file: signedUrl,
    })

    // Cleanup
    await unlink(baseVideoPath)
    await unlink(outputPath)

    // Update queue status
    const queueDoc = await adminDb.collection('video_queue')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get()

    if (!queueDoc.empty) {
      await adminDb.collection('video_queue').doc(queueDoc.docs[0].id).update({
        status: 'completed',
        completedAt: new Date(),
        videoPath: storagePath,
      })
    }

  } catch (error) {
    console.error('Video generation error:', error)
    await sendMessage(userId, "Sorry, there was an error creating your custom video. Please try again later.")
  }
}

async function getBaseVideos() {
  const snapshot = await adminDb.collection('base_videos').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function downloadBaseVideo(storagePath) {
  const fileRef = adminStorage.bucket().file(storagePath)
  const localPath = `/tmp/base_${Date.now()}.mp4`
  await fileRef.download({ destination: localPath })
  return localPath
}

