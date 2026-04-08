'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Settings, Camera, X, Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuthFetch } from '@/lib/useAuthFetch'

interface EditProfileProps {
  currentName: string
  currentAvatar: string | null
}

export default function EditProfile({ currentName, currentAvatar }: EditProfileProps) {
  const authFetch = useAuthFetch()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentAvatar)
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    if (name.length < 3) {
      alert("Username must be at least 3 characters")
      return
    }

    setLoading(true)
    try {
      let avatarData = null

      // Prepare avatar for server-side upload if changed
      const file = fileInputRef.current?.files?.[0]
      if (file) {
        // Convert to base64 for server upload
        const reader = new FileReader()
        const readerPromise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result)
        })
        reader.readAsDataURL(file)
        avatarData = await readerPromise
      }

      // Update via Proxy API (Bypasses all client-side RLS)
      const response = await authFetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          displayName: name, 
          avatarPayload: avatarData // Send the image to the server
        })
      })

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setIsOpen(false)
      router.refresh()
    } catch (err: unknown) {
      const error = err as Error
      console.error("Update failed:", error)
      alert(`Update Error: ${error.message || "Failed to persist identity."}`)
    } finally {
      setLoading(false)
    }
  }

  const modalContent = isOpen ? (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="glass w-full max-w-md p-10 rounded-[3rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-8 right-8 text-muted-foreground hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-black mb-10 tracking-tight text-center">Edit Profile</h2>

        <div className="space-y-10">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4">
            <div 
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="h-32 w-32 rounded-[2rem] bg-muted/30 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/50 relative shadow-2xl">
                {preview ? (
                  <Image src={preview} alt="Preview" width={128} height={128} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <Camera className="w-10 h-10 text-muted-foreground" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Change Identity Photo</span>
          </div>

          {/* Username Input */}
          <div className="space-y-3">
            <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">Display Name</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all font-bold text-lg"
              placeholder="Your username..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6">
            <button 
              onClick={() => setIsOpen(false)}
              className="flex-1 px-8 py-4 rounded-2xl border border-white/10 font-bold hover:bg-white/5 transition-all text-sm uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={loading}
              className="flex-[2] px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-black shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-sm uppercase tracking-widest"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" /> Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground group"
        aria-label="Edit Profile"
      >
        <Settings className="w-4 h-4 transition-transform group-hover:rotate-45" />
      </button>

      {mounted && typeof document !== 'undefined' && createPortal(modalContent, document.body)}
    </>
  )
}
