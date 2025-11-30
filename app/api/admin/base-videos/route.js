import { NextResponse } from 'next/server'
import { adminDb, adminStorage } from '@/lib/firebase-admin'

export async function GET() {
  try {
    const snapshot = await adminDb.collection('base_videos').get()
    const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return NextResponse.json({ videos })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const name = formData.get('name')

    if (!file) {
      return NextResponse.json({ error: 'File required' }, { status: 400 })
    }

    // Upload to Firebase Storage
    const storagePath = `base_videos/${Date.now()}_${file.name}`
    const bucket = adminStorage.bucket()
    const fileRef = bucket.file(storagePath)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fileRef.save(buffer, {
      metadata: {
        contentType: 'video/mp4',
      },
    })

    // Save to Firestore
    const doc = await adminDb.collection('base_videos').add({
      name: name || file.name,
      storagePath,
      fileName: file.name,
      uploadedAt: new Date(),
    })

    return NextResponse.json({ success: true, id: doc.id })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    const doc = await adminDb.collection('base_videos').doc(id).get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    const data = doc.data()
    
    // Delete from Storage
    await adminStorage.bucket().file(data.storagePath).delete()
    
    // Delete from Firestore
    await adminDb.collection('base_videos').doc(id).delete()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

