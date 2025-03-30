import { NextRequest, NextResponse } from 'next/server'
import { AddressTag } from '@/types'
import { ethers } from 'ethers'
import { TagsDB } from '@/utils/db'

// Verify the signature to authenticate the user
function verifySignature(message: string, signature: string, address: string): boolean {
  try {
    const signerAddress = ethers.utils.verifyMessage(message, signature)
    return signerAddress.toLowerCase() === address.toLowerCase()
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')?.toLowerCase()
  
  if (!address) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
  }
  
  // Get tags from the database
  const userTags = TagsDB.findByWallet(address)
  
  return NextResponse.json(userTags)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { address, tag, createdBy, signature } = body
  
  if (!address || !tag || !createdBy || !signature) {
    return NextResponse.json(
      { error: 'Address, tag, createdBy, and signature are required' },
      { status: 400 }
    )
  }
  
  // Create message that was supposed to be signed
  const message = `I want to create a tag "${tag}" for address ${address}`
  
  // Verify the signature
  const isValidSignature = verifySignature(message, signature, createdBy)
  
  if (!isValidSignature) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }
  
  // Create new tag in the database
  const newTag = TagsDB.create({
    address: address.toLowerCase(),
    tag,
    createdBy: createdBy.toLowerCase(),
  })
  
  return NextResponse.json(newTag, { status: 201 })
} 