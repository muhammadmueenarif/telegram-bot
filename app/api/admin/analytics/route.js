import { NextResponse } from 'next/server'
import { getTransactions, getAllUsers } from '@/lib/database'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const transactions = await getTransactions(startDate, endDate)
    const users = await getAllUsers()

    // Calculate revenue
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0)

    // Revenue by category
    const revenueByCategory = {}
    for (const transaction of transactions) {
      if (transaction.contentId) {
        const content = await adminDb.collection('content').doc(transaction.contentId).get()
        if (content.exists) {
          const category = content.data().category || 'uncategorized'
          revenueByCategory[category] = (revenueByCategory[category] || 0) + transaction.amount
        }
      }
    }

    // User spending list
    const userSpending = users
      .map(u => ({ userId: u.userId, totalSpent: u.totalSpent || 0, tier: u.tier }))
      .sort((a, b) => b.totalSpent - a.totalSpent)

    return NextResponse.json({
      totalRevenue,
      transactionCount: transactions.length,
      revenueByCategory,
      userSpending,
      transactions: transactions.slice(0, 100), // Last 100 transactions
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

