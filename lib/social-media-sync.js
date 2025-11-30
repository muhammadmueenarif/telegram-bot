import axios from 'axios'
import puppeteer from 'puppeteer'
import { analyzeMediaWithVision } from './openai.js'
import { saveSocialMemory } from './database.js'
import { adminDb } from './firebase-admin.js'

export async function syncInstagramStories() {
  try {
    // This would require Instagram API or scraping
    // For now, placeholder implementation
    console.log('Syncing Instagram Stories...')
    // Implementation would fetch stories, analyze with vision, save to Firebase
  } catch (error) {
    console.error('Instagram sync error:', error)
  }
}

export async function syncInstagramReels() {
  try {
    console.log('Syncing Instagram Reels...')
    // Fetch reels, analyze, save
  } catch (error) {
    console.error('Instagram Reels sync error:', error)
  }
}

export async function syncTikTokVideos() {
  try {
    console.log('Syncing TikTok videos...')
    // Fetch TikTok videos, analyze, save
  } catch (error) {
    console.error('TikTok sync error:', error)
  }
}

export async function syncYouTubeVideos() {
  try {
    const channelId = process.env.YOUTUBE_CHANNEL_ID
    if (!channelId) return

    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        channelId,
        maxResults: 5,
        order: 'date',
        type: 'video',
        key: process.env.YOUTUBE_API_KEY,
      },
    })

    for (const item of response.data.items) {
      const videoId = item.id.videoId
      const thumbnailUrl = item.snippet.thumbnails.high.url
      
      // Check if already synced
      const existing = await adminDb.collection('social_memories')
        .where('url', '==', `https://youtube.com/watch?v=${videoId}`)
        .get()

      if (!existing.empty) continue

      // Analyze with vision
      const analysis = await analyzeMediaWithVision(thumbnailUrl, 'youtube video')
      
      if (analysis) {
        await saveSocialMemory('youtube', `https://youtube.com/watch?v=${videoId}`, 
          `YouTube: ${item.snippet.title} - ${analysis.summary}`, {
            title: item.snippet.title,
            description: item.snippet.description,
            ...analysis,
          })
      }
    }
  } catch (error) {
    console.error('YouTube sync error:', error)
  }
}

export async function runAllSyncs() {
  await Promise.all([
    syncInstagramStories(),
    syncInstagramReels(),
    syncTikTokVideos(),
    syncYouTubeVideos(),
  ])
  console.log('All social media syncs completed')
}

