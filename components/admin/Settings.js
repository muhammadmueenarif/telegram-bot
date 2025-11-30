'use client'

import { useState } from 'react'

export default function Settings({ token }) {
  const [showWipe, setShowWipe] = useState(false)
  const [wipePassword, setWipePassword] = useState('')
  const [wipeConfirm, setWipeConfirm] = useState('')

  const handleWipe = async () => {
    if (wipePassword !== wipeConfirm) {
      alert('Passwords do not match')
      return
    }

    if (!confirm('Are you absolutely sure? This will delete ALL content permanently!')) {
      return
    }

    try {
      const response = await fetch('/api/admin/wipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          password: wipePassword,
          confirmPassword: wipeConfirm,
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert('All content wiped successfully')
        setShowWipe(false)
        setWipePassword('')
        setWipeConfirm('')
      } else {
        alert(data.error || 'Wipe failed')
      }
    } catch (error) {
      alert('Wipe failed')
    }
  }

  return (
    <div>
      <h2>Settings</h2>

      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ff4444', borderRadius: '8px', backgroundColor: '#ffe6e6' }}>
        <h3 style={{ color: '#ff4444' }}>Danger Zone</h3>
        <p>Permanently delete all content from the system.</p>
        <button
          onClick={() => setShowWipe(!showWipe)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#ff4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '0.5rem',
          }}
        >
          {showWipe ? 'Cancel' : 'Wipe All Content'}
        </button>

        {showWipe && (
          <div style={{ marginTop: '1rem' }}>
            <input
              type="password"
              placeholder="Enter password to confirm"
              value={wipePassword}
              onChange={(e) => setWipePassword(e.target.value)}
              style={{ padding: '0.5rem', marginRight: '0.5rem', width: '200px' }}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={wipeConfirm}
              onChange={(e) => setWipeConfirm(e.target.value)}
              style={{ padding: '0.5rem', marginRight: '0.5rem', width: '200px' }}
            />
            <button
              onClick={handleWipe}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ff0000',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Confirm Wipe
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

