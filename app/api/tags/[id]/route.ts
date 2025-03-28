import { NextRequest, NextResponse } from 'next/server'
import { AddressTag } from '@/types'

// Reference to the mock tags (in a real app, this would be a database)
// We're sharing this reference with the parent tags route
let mockTags: AddressTag[] = []
try {
  // This is a workaround for Next.js route isolation, in a real app you'd use a database
  mockTags = require('../../tags/route').mockTags 
} catch (error) {
  // If we can't import the tags, use an empty array
  console.error('Could not import mockTags, using empty array:', error)
  mockTags = []
}

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
  
  // Find the tag
  const tagIndex = mockTags.findIndex(
    (tag) => tag.id === id && tag.createdBy === walletAddress.toLowerCase()
  )
  
  if (tagIndex === -1) {
    return NextResponse.json(
      { error: 'Tag not found or you do not have permission to delete it' },
      { status: 404 }
    )
  }
  
  // Remove the tag
  mockTags.splice(tagIndex, 1)
  
  return NextResponse.json({ success: true })
} 