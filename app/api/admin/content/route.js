import { NextResponse } from 'next/server'
import { getAllContent, createContent, updateContent, deleteContent } from '@/lib/database'
import { adminStorage } from '@/lib/firebase-admin'

export async function GET() {
  try {
    const content = await getAllContent()
    return NextResponse.json({ content })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const title = formData.get('title')
    const category = formData.get('category')
    const price = parseFloat(formData.get('price'))
    const type = formData.get('type')
    const caption = formData.get('caption')

    if (!file) {
      return NextResponse.json({ error: 'File required' }, { status: 400 })
    }

    // Upload to Firebase Storage
    const storagePath = `content/${category}/${Date.now()}_${file.name}`
    const bucket = adminStorage.bucket()
    const fileRef = bucket.file(storagePath)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    })

    // Save to Firestore
    const contentId = await createContent({
      title,
      category,
      price,
      type,
      caption,
      storagePath,
      fileName: file.name,
    })

    return NextResponse.json({ success: true, contentId })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const { id, ...updates } = await request.json()
    await updateContent(id, updates)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    await deleteContent(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

