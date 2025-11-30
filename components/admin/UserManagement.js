'use client'

import { useState, useEffect } from 'react'

export default function UserManagement({ token }) {
  const [users, setUsers] = useState([])

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  return (
    <div>
      <h2>User Management</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc' }}>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>User ID</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Total Spent</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tier</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Purchased Content</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{user.userId}</td>
              <td style={{ padding: '0.5rem' }}>${(user.totalSpent || 0).toFixed(2)}</td>
              <td style={{ padding: '0.5rem' }}>{user.tier || 'free'}</td>
              <td style={{ padding: '0.5rem' }}>{(user.purchasedContent || []).length} items</td>
              <td style={{ padding: '0.5rem' }}>
                <button style={{ padding: '0.25rem 0.5rem', marginRight: '0.5rem', cursor: 'pointer' }}>
                  Block
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

