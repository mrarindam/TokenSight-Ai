import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { displayName, avatarPayload } = await req.json()
    
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

    let avatarUrl = undefined

    // 1. Process Avatar if provided
    if (avatarPayload && avatarPayload.startsWith('data:image/')) {
      const base64Data = avatarPayload.split(';base64,').pop()
      const extension = avatarPayload.split(';')[0].split('/')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      const fileName = `${session.user.id}-${Date.now()}.${extension}`

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

      avatarUrl = publicUrl
    }

    // 2. Update DB
    const updateData: { display_name: string; username: string; avatar_url?: string } = { 
      display_name: displayName, 
      username: displayName 
    }
    
    if (avatarUrl) updateData.avatar_url = avatarUrl

    const { error: dbError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', session.user.id)

    if (dbError) throw dbError

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const error = err as Error
    console.error("[API_USER_UPDATE] Error:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
