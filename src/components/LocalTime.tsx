'use client'

import React, { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface LocalTimeProps {
  timestamp: string | null
  mode?: 'relative' | 'absolute' | 'tooltip' | 'smart'
}

export default function LocalTime({ timestamp, mode = 'relative' }: LocalTimeProps) {
  const [localText, setLocalText] = useState<string>('')
  
  useEffect(() => {
    if (!timestamp) {
      setLocalText(mode === 'relative' || mode === 'smart' ? 'No activity yet' : '')
      return
    }

    // Force date to be parsed as UTC if no timezone exists
    const normalizedTimestamp = timestamp.trim().replace(' ', 'T')
    const finalIso = (normalizedTimestamp.includes('Z') || normalizedTimestamp.includes('+')) 
       ? normalizedTimestamp 
       : normalizedTimestamp + 'Z'

    const date = new Date(finalIso)
    
    // Check for invalid dates
    if (isNaN(date.getTime())) {
      setLocalText(mode === 'relative' || mode === 'smart' ? 'No activity yet' : 'Invalid Date')
      return;
    }

    if (mode === 'relative') {
      setLocalText(formatDistanceToNow(date, { addSuffix: true }))
    } else if (mode === 'smart') {
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMin = Math.floor(diffMs / (1000 * 60))
      const diffHr = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMin < 60) {
        setLocalText(`${Math.max(0, diffMin)} min ago`)
      } else if (diffHr < 24) {
        const mins = diffMin % 60
        setLocalText(mins > 0 ? `${diffHr}h ${mins}m ago` : `${diffHr}h ago`)
      } else if (diffDay <= 3) {
        setLocalText(`${diffDay} day${diffDay > 1 ? 's' : ''} ago`)
      } else {
        setLocalText(date.toLocaleDateString(undefined, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }))
      }
    } else if (mode === 'absolute') {
      setLocalText(date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }))
    } else if (mode === 'tooltip') {
      setLocalText(date.toLocaleString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).toUpperCase())
    }
  }, [timestamp, mode])

  // Return a fragment with the client-hydrated local text
  return <>{localText}</>
}
