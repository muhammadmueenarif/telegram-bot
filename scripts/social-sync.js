import dotenv from 'dotenv'
import { runAllSyncs } from '../lib/social-media-sync.js'
import cron from 'node-cron'

dotenv.config({ path: '.env.local' })

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running social media sync...')
  await runAllSyncs()
})

console.log('Social media sync scheduler started. Running every hour.')

// Keep process alive
process.stdin.resume()

