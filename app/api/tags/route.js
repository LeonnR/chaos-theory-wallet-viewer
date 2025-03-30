import { NextResponse } from 'next/server';
import supabase from '@/utils/supabase';
import { ethers } from 'ethers';

// GET tags for a wallet address
export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  
  if (!address) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }
  
  try {
    // Query tags
    let query = supabase
      .from('address_tags')
      .select('*')
      .order('created_at', { ascending: false });
    
    // If address is provided, filter by createdBy
    if (address) {
      query = query.eq('created_by', address.toLowerCase());
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

// POST a new tag with signature verification
export async function POST(request) {
  try {
    const body = await request.json();
    const { address, tag, createdBy, signature } = body;
    
    if (!address || !tag || !createdBy || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Verify the signature
    const message = `I want to create a tag "${tag}" for address ${address}`;
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== createdBy.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // Insert the tag
    const { data, error } = await supabase
      .from('address_tags')
      .insert([
        {
          id: `${address.toLowerCase()}_${Date.now()}`,
          address: address.toLowerCase(),
          tag,
          created_by: createdBy.toLowerCase(),
          signature
        }
      ])
      .select();
    
    if (error) throw error;
    
    return NextResponse.json(data[0] || { success: true });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tag' },
      { status: 500 }
    );
  }
}

// DELETE a tag
export async function DELETE(request) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const createdBy = searchParams.get('createdBy');
  
  if (!id || !createdBy) {
    return NextResponse.json(
      { error: 'Tag ID and creator address are required' },
      { status: 400 }
    );
  }
  
  try {
    // First check if the tag exists and was created by the user
    const { data: tagData, error: tagError } = await supabase
      .from('address_tags')
      .select('*')
      .eq('id', id)
      .eq('created_by', createdBy.toLowerCase())
      .single();
    
    if (tagError) {
      return NextResponse.json(
        { error: 'Tag not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }
    
    // If tag exists and was created by the user, delete it
    const { error } = await supabase
      .from('address_tags')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete tag' },
      { status: 500 }
    );
  }
} 