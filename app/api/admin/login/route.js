import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH

export async function POST(request) {
  try {
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }

    // Verify password
    const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH || '')

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // Generate JWT token
    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '24h',
    })

    return NextResponse.json({ token })
  } catch (error) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

