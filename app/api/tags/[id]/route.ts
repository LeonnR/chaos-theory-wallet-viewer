import { NextRequest, NextResponse } from 'next/server'
import { TagsDB } from '@/utils/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id
  const body = await request.json()
  const { walletAddress } = body
  
  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    )
  }
  
  // Check if tag exists and is owned by the user
  const success = TagsDB.deleteById(id, walletAddress.toLowerCase())
  
  if (!success) {
    return NextResponse.json(
      { error: 'Tag not found or you do not have permission to delete it' },
      { status: 404 }
    )
  }
  
  return NextResponse.json({ success: true })
} 