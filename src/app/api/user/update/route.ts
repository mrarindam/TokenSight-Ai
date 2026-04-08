import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAuthUser } from "@/lib/auth"

export async function POST(req: Request) {
  const authUser = await getAuthUser(req)
  
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { displayName, avatarPayload, avatarUrl, removeAvatar } = await req.json()
    
    // Initialize Supabase with SERVICE ROLE KEY to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    let resolvedAvatarUrl: string | null | undefined = undefined

    // 1. Process Avatar if provided
    if (avatarPayload && avatarPayload.startsWith('data:image/')) {
      const base64Data = avatarPayload.split(';base64,').pop()
      const extension = avatarPayload.split(';')[0].split('/')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      const fileName = `${authUser.id}-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, buffer, { 
          contentType: `image/${extension}`,
          upsert: true 
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      resolvedAvatarUrl = publicUrl
    } else if (removeAvatar) {
      resolvedAvatarUrl = null
    } else if (typeof avatarUrl === 'string' && /^https?:\/\//.test(avatarUrl)) {
      resolvedAvatarUrl = avatarUrl
    }

    // 2. Update DB
    const updateData: { display_name?: string; username?: string; avatar_url?: string | null } = {}
    
    if (typeof displayName === 'string' && displayName.trim()) {
      updateData.display_name = displayName
      updateData.username = displayName
    }

    if (resolvedAvatarUrl !== undefined) updateData.avatar_url = resolvedAvatarUrl

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No profile changes provided' }, { status: 400 })
    }

    const { error: dbError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', authUser.id)

    if (dbError) throw dbError

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const error = err as Error
    console.error("[API_USER_UPDATE] Error:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
