'use client'

import { useState, useEffect } from 'react'
import ContentManagement from '@/components/admin/ContentManagement'
import Analytics from '@/components/admin/Analytics'
import UserManagement from '@/components/admin/UserManagement'
import Settings from '@/components/admin/Settings'

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState('content')
  const [token, setToken] = useState(null)

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token')
    if (savedToken) {
      setToken(savedToken)
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = async (password) => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()
      if (data.token) {
        setToken(data.token)
        localStorage.setItem('admin_token', data.token)
        setIsAuthenticated(true)
      } else {
        alert('Invalid password')
      }
    } catch (error) {
      alert('Login failed')
    }
  }

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ padding: '2rem', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h1>Admin Login</h1>
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(e.target.password.value) }}>
            <input
              type="password"
              name="password"
              placeholder="Password"
              style={{ padding: '0.5rem', margin: '0.5rem 0', width: '100%' }}
            />
            <button type="submit" style={{ padding: '0.5rem 1rem', width: '100%' }}>
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <nav style={{ backgroundColor: '#333', color: 'white', padding: '1rem' }}>
        <h1>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button onClick={() => setActiveTab('content')} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Content
          </button>
          <button onClick={() => setActiveTab('analytics')} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Analytics
          </button>
          <button onClick={() => setActiveTab('users')} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Users
          </button>
          <button onClick={() => setActiveTab('settings')} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Settings
          </button>
        </div>
      </nav>

      <main style={{ padding: '2rem' }}>
        {activeTab === 'content' && <ContentManagement token={token} />}
        {activeTab === 'analytics' && <Analytics token={token} />}
        {activeTab === 'users' && <UserManagement token={token} />}
        {activeTab === 'settings' && <Settings token={token} />}
      </main>
    </div>
  )
}

