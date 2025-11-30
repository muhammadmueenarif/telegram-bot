import { NextResponse } from 'next/server'
import { handlePreCheckout, handleSuccessfulPayment } from '@/lib/payments'

export async function POST(request) {
  try {
    const update = await request.json()

    // Handle pre-checkout query
    if (update.pre_checkout_query) {
      const approved = await handlePreCheckout(update.pre_checkout_query)
      return NextResponse.json({ ok: approved })
    }

    // Handle successful payment
    if (update.message && update.message.successful_payment) {
      await handleSuccessfulPayment(update.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

