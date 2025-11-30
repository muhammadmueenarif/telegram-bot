'use client'

import { useState, useEffect } from 'react'

export default function ContentManagement({ token }) {
  const [content, setContent] = useState([])
  const [categories, setCategories] = useState([])
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadContent()
    loadCategories()
  }, [])

  const loadContent = async () => {
    try {
      const response = await fetch('/api/admin/content', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setContent(data.content || [])
    } catch (error) {
      console.error('Error loading content:', error)
    }
  }

  const loadCategories = async () => {
    // Load categories from API or use default
    setCategories(['photos', 'videos', 'custom'])
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    setUploading(true)

    const formData = new FormData(e.target)
    
    try {
      const response = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await response.json()
      if (data.success) {
        alert('Content uploaded successfully!')
        loadContent()
        setShowUpload(false)
        e.target.reset()
      }
    } catch (error) {
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this content?')) return

    try {
      await fetch(`/api/admin/content?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      loadContent()
    } catch (error) {
      alert('Delete failed')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Content Management</h2>
        <button onClick={() => setShowUpload(!showUpload)} style={{ padding: '0.5rem 1rem' }}>
          {showUpload ? 'Cancel' : 'Upload Content'}
        </button>
      </div>

      {showUpload && (
        <form onSubmit={handleUpload} style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
          <input type="file" name="file" required style={{ marginBottom: '1rem', width: '100%' }} />
          <input type="text" name="title" placeholder="Title" required style={{ marginBottom: '1rem', width: '100%', padding: '0.5rem' }} />
          <select name="category" required style={{ marginBottom: '1rem', width: '100%', padding: '0.5rem' }}>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select name="type" required style={{ marginBottom: '1rem', width: '100%', padding: '0.5rem' }}>
            <option value="photo">Photo</option>
            <option value="video">Video</option>
          </select>
          <input type="number" name="price" placeholder="Price (in Stars)" required step="0.01" style={{ marginBottom: '1rem', width: '100%', padding: '0.5rem' }} />
          <textarea name="caption" placeholder="Caption" style={{ marginBottom: '1rem', width: '100%', padding: '0.5rem' }} />
          <button type="submit" disabled={uploading} style={{ padding: '0.5rem 1rem', width: '100%' }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
        {content.map(item => (
          <div key={item.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem' }}>
            <h3>{item.title}</h3>
            <p>Category: {item.category}</p>
            <p>Price: {item.price} Stars</p>
            <p>Type: {item.type}</p>
            <button onClick={() => handleDelete(item.id)} style={{ marginTop: '0.5rem', padding: '0.25rem 0.5rem', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

