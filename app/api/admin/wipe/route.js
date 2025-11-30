import { NextResponse } from 'next/server'
import { adminDb, adminStorage } from '@/lib/firebase-admin'
import bcrypt from 'bcryptjs'

export async function POST(request) {
  try {
    const { password, confirmPassword } = await request.json()

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    // Verify password
    const isValid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || '')
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // Delete all content from Firestore
    const contentSnapshot = await adminDb.collection('content').get()
    const deletePromises = contentSnapshot.docs.map(doc => doc.ref.delete())
    await Promise.all(deletePromises)

    // Delete all files from Storage
    const bucket = adminStorage.bucket()
    const [files] = await bucket.getFiles({ prefix: 'content/' })
    const deleteFilePromises = files.map(file => file.delete())
    await Promise.all(deleteFilePromises)

    return NextResponse.json({ success: true, message: 'All content wiped successfully' })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

