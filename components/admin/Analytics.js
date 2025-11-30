'use client'

import { useState, useEffect } from 'react'

export default function Analytics({ token }) {
  const [analytics, setAnalytics] = useState(null)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    loadAnalytics()
  }, [month, year])

  const loadAnalytics = async () => {
    try {
      const response = await fetch(`/api/admin/analytics?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Error loading analytics:', error)
    }
  }

  if (!analytics) {
    return <div>Loading analytics...</div>
  }

  return (
    <div>
      <h2>Analytics</h2>
      
      <div style={{ marginBottom: '2rem' }}>
        <label>Month: </label>
        <input type="number" value={month} onChange={(e) => setMonth(parseInt(e.target.value))} min="1" max="12" style={{ marginRight: '1rem' }} />
        <label>Year: </label>
        <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ccc' }}>
          <h3>Total Revenue</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>${analytics.totalRevenue?.toFixed(2) || '0.00'}</p>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ccc' }}>
          <h3>Transactions</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{analytics.transactionCount || 0}</p>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>Revenue by Category</h3>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {Object.entries(analytics.revenueByCategory || {}).map(([category, amount]) => (
            <div key={category} style={{ padding: '0.5rem', backgroundColor: 'white', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span>{category}</span>
              <span>${amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3>Top Spenders</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>User ID</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Total Spent</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tier</th>
            </tr>
          </thead>
          <tbody>
            {analytics.userSpending?.slice(0, 20).map((user, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{user.userId}</td>
                <td style={{ padding: '0.5rem' }}>${user.totalSpent.toFixed(2)}</td>
                <td style={{ padding: '0.5rem' }}>{user.tier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

