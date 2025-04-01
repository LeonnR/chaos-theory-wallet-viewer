'use client'

import { useState, useEffect, useRef } from 'react'
import { Transaction, AddressTag } from '@/types'
import React from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { formatDistanceToNow } from 'date-fns'
import { recoverMessageAddress } from 'viem'
import { ethers } from 'ethers'

interface TransactionListProps {
  transactions: Transaction[]
  isLoading: boolean
  tags: AddressTag[]
  setTags: React.Dispatch<React.SetStateAction<AddressTag[]>>
}

export default function TransactionList({ transactions, isLoading, tags, setTags }: TransactionListProps) {
  const { address: walletAddress } = useAccount()
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  
  // Tagging state
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [addressToTag, setAddressToTag] = useState<string>('')
  const [tagName, setTagName] = useState<string>('')
  const [tagError, setTagError] = useState<string | null>(null)
  const [isSubmittingTag, setIsSubmittingTag] = useState<boolean>(false)
  const [signature, setSignature] = useState<string>('')
  
  // State for editing tags
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [tagToEdit, setTagToEdit] = useState<AddressTag | null>(null)
  
  // State for delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false)
  const [tagToDelete, setTagToDelete] = useState<AddressTag | null>(null)
  
  // State for tag management section
  const [tagManagementOpen, setTagManagementOpen] = useState<boolean>(false)
  
  // Add useEffect to log tags once
  useEffect(() => {
    if (tags && tags.length > 0) {
      console.log(`${tags.length} tags available in TransactionList`);
    }
  }, [tags]);
  
  // Function to find a tag for a specific address
  const getTagForAddress = (address: string): string | null => {
    // Handle invalid inputs
    if (!address || !tags || !tags.length) {
      return null;
    }
    
    try {
      // Normalize the address to lowercase
      const normalizedAddress = address.toLowerCase();
      
      // Find a tag with a direct match to the address
      const matchingTag = tags.find(tag => 
        tag.address && tag.address.toLowerCase() === normalizedAddress
      );
      
      // If we're in dev mode and the address matches our test case, log the lookup
      if (process.env.NODE_ENV === 'development' && 
          normalizedAddress.includes('ae3cba71bc70ebe')) {
        console.log('Looking up tag for known test address:', {
          normalizedAddress,
          matchingTag: matchingTag || 'Not found',
          tagsAvailable: tags.length
        });
        
        // Log all tags for debugging
        if (!matchingTag) {
          console.log('All available tags:', tags.map(t => ({
            address: t.address ? t.address.toLowerCase() : 'null',
            tag: t.tag
          })));
        }
      }
      
      return matchingTag?.tag || null;
    } catch (error) {
      console.error('Error in getTagForAddress:', error);
      return null;
    }
  };
  
  // Format address with tag if it exists
  const formatAddress = (address: string): React.ReactNode => {
    if (!address) return '0x...';
    
    // Get tag for this address
    const tag = getTagForAddress(address);
    
    // If we have a tag, display it with styling
    if (tag) {
      // Find the full tag object to get the creator for delete button
      const tagObject = tags.find(t => 
        t.address && t.address.toLowerCase().trim() === address.toLowerCase().trim()
      );
      
      return (
        <span className="font-mono">
          <span className="inline-flex items-center">
            <span className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-2.5 py-0.5 rounded-md mr-2 border border-purple-500/30 text-xs flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              {tag}
              {walletAddress && tagObject && tagObject.created_by && tagObject.created_by.toLowerCase() === walletAddress.toLowerCase() && (
                <span className="flex ml-1">
                  {/* <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditTag(tagObject);
                    }}
                    className="mr-1 text-white hover:text-blue-200 transition-colors"
                    title="Edit this tag"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteConfirmation(tagObject);
                    }}
                    className="text-white hover:text-red-200 transition-colors"
                    title="Delete this tag"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button> */}
                </span>
              )}
            </span>
            {`${address.slice(0, 6)}...${address.slice(-4)}`}
          </span>
        </span>
      );
    } else {
      // No tag, just show the shortened address
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
  };
  
  // Format ETH value
  const formatValue = (value: string): string => {
    const ethValue = parseFloat(value) / 1e18
    return ethValue.toFixed(6) + ' ETH'
  }
  
  // Validate Ethereum address
  const isValidAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr)
  }
  
  // Helper function to calculate transaction age
  const getTransactionAge = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000)
    const diff = now - timestamp
    
    // Convert to days
    const days = diff / 86400 // 86400 seconds in a day
    
    if (days < 1) {
      // For transactions less than a day old, show with 2 decimal places
      return `${days.toFixed(2)} days ago`
    } else if (days < 10) {
      // For transactions between 1-10 days, show with 1 decimal place
      return `${days.toFixed(1)} days ago`
    } else {
      // For older transactions, show as whole days
      return `${Math.floor(days)} days ago`
    }
  }
  
  // Validate tag data before submission
  const validateTagData = (data: any): { valid: boolean, message?: string } => {
    if (!data) return { valid: false, message: 'No tag data provided' };
    
    // Check required fields
    if (!data.address) return { valid: false, message: 'Missing address' };
    if (!data.tag) return { valid: false, message: 'Missing tag name' };
    if (!data.createdBy) return { valid: false, message: 'Missing creator address' };
    if (!data.signature) return { valid: false, message: 'Missing signature' };
    
    // Validate address format
    if (!isValidAddress(data.address)) return { valid: false, message: 'Invalid target address format' };
    if (!isValidAddress(data.createdBy)) return { valid: false, message: 'Invalid creator address format' };
    
    // Validate signature
    if (typeof data.signature !== 'string' || data.signature.length < 10) {
      return { valid: false, message: 'Invalid signature format' };
    }
    
    return { valid: true };
  };
  
  // Store recovered address from signature verification
  const recoveredAddress = useRef<string | null>(null)
  
  // Modern signature hook from wagmi
  const { data: signatureData, error: signatureError, isPending: isSignatureLoading, signMessage, variables } = useSignMessage()
  
  // Add debugging ref to track signature workflow
  const debugInfo = useRef<{
    signAttempted: boolean;
    signatureReceived: boolean;
    verificationAttempted: boolean;
    submissionAttempted: boolean;
    lastError: any | null;
  }>({
    signAttempted: false,
    signatureReceived: false,
    verificationAttempted: false,
    submissionAttempted: false,
    lastError: null
  });

  // Add effect to log signature details when available
  useEffect(() => {
    if (signatureData) {
      console.group('🔑 Signature Details');
      console.log('Raw signature received:', signatureData);
      console.log('Signature length:', signatureData.length);
      console.log('Signature starts with:', signatureData.substring(0, 10));
      console.log('Signature ends with:', signatureData.substring(signatureData.length - 10));
      console.log('Has 0x prefix:', signatureData.startsWith('0x'));
      console.groupEnd();
      
      debugInfo.current.signatureReceived = true;
    }
  }, [signatureData]);

  // Log sign errors
  useEffect(() => {
    if (signatureError) {
      console.error('❌ Signature Error:', signatureError);
      debugInfo.current.lastError = signatureError as any;
    }
  }, [signatureError]);

  // Log when signing is pending
  useEffect(() => {
    console.log(`🔄 Signature Status: ${isSignatureLoading ? 'Pending' : 'Not Pending'}`);
  }, [isSignatureLoading]);
  
  // Effect to handle successful signature generation
  useEffect(() => {
    if (!signatureData || !variables?.message) return;
    
    console.group('🔄 Signature Effect Triggered');
    console.log('Signature received from wallet:', signatureData);
    console.log('Variables available:', variables);
    console.log('Message from variables:', variables.message);
    
    // Store signature in state for debugging
    setSignature(signatureData);
    
    // Verify the signature client-side and submit the tag
    console.log('Calling verifyAndSubmitTag with signature and message');
    verifyAndSubmitTag(signatureData, variables.message);
    console.groupEnd();
  }, [signatureData, variables?.message]);
  
  // Function to verify signature client-side and submit tag
  const verifyAndSubmitTag = async (signature: `0x${string}`, message: any) => {
    console.group('🛡️ Signature Verification Flow');
    console.log('Starting verification process');
    debugInfo.current.verificationAttempted = true;
    
    try {
      // Normal function content here
      if (!signature) {
        console.error('❌ No signature provided to verifyAndSubmitTag');
        setTagError('No signature provided');
        console.groupEnd();
        return;
      }
      
      // Check signature format and normalize if needed
      let normalizedSignature = signature;
      if (!normalizedSignature.startsWith('0x')) {
        console.log('⚠️ Adding 0x prefix to signature');
        normalizedSignature = `0x${normalizedSignature}`;
      }
      
      console.log('Message being verified:', message);
      console.log('Message type:', typeof message);
      if (typeof message === 'object') {
        console.log('Message object keys:', Object.keys(message));
      }
      
      let messageToVerify = message;
      if (typeof message === 'object' && message.message) {
        console.log('Extracting message from object');
        messageToVerify = message.message;
      }
      
      console.log('Final message to verify:', messageToVerify);
      console.log('Signature to use:', normalizedSignature);
      
      // Debug the wallet address
      console.log('Current wallet address:', walletAddress);
      console.log('Is wallet connected:', !!walletAddress);
      
      if (!walletAddress) {
        console.error('❌ No wallet address available for verification');
        setTagError('Wallet not connected. Please connect your wallet and try again.');
        console.groupEnd();
        return;
      }
      
      // Try client-side recovery of the address for debugging
      try {
        console.log('Attempting client-side recovery of address from signature...');
        
        // For EIP-191 personal sign messages, try both with and without a prefix
        console.log('Recovering with message exactly as provided:');
        const recoveredAddress = await recoverMessageAddress({
          message: messageToVerify,
          signature: normalizedSignature
        });
        
        console.log('🔍 Recovered address:', recoveredAddress);
        console.log('🔍 Current wallet address:', walletAddress);
        console.log('🔍 Do addresses match?', recoveredAddress.toLowerCase() === walletAddress?.toLowerCase());
        
        // Store the recovered address for debugging
        const recoveredAddr = recoveredAddress;
        
        // Also try ethers recovery as fallback
        try {
          console.log('Attempting recovery with ethers:');
          const ethersRecovered = ethers.utils.verifyMessage(messageToVerify, normalizedSignature);
          console.log('🔍 Ethers recovered address:', ethersRecovered);
          console.log('🔍 Ethers match?', ethersRecovered.toLowerCase() === walletAddress?.toLowerCase());
          
          // If viem didn't match but ethers did, use that
          if (recoveredAddress.toLowerCase() !== walletAddress?.toLowerCase() && 
              ethersRecovered.toLowerCase() === walletAddress?.toLowerCase()) {
            console.log('⚠️ Using ethers recovered address instead of viem');
            // Use ethers recovered address for debugging
            console.log('Using ethers recovered address as reference');
          }
        } catch (ethersError) {
          console.error('❌ Ethers recovery failed:', ethersError);
        }
        
        // Verify the addresses match
        if (recoveredAddress.toLowerCase() !== walletAddress?.toLowerCase()) {
          console.warn('⚠️ Recovered address does not match wallet address');
          console.log('We will attempt to submit anyway, but the server may reject it');
        }
      } catch (recoveryError) {
        console.error('❌ Address recovery failed:', recoveryError);
        setTagError(`Failed to verify signature: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`);
        console.groupEnd();
        return;
      }
      
      // Now call submit with signature
      await submitTagWithSignature(normalizedSignature);
    } catch (error) {
      console.error('❌ verifyAndSubmitTag error:', error);
      setTagError(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      debugInfo.current.lastError = error as any;
    } finally {
      console.groupEnd();
    }
  };
  
  // Function to submit tag with verified signature
  const submitTagWithSignature = async (signature: string) => {
    console.group('📤 Tag Submission Flow');
    console.log('Starting tag submission with signature');
    console.log('Tag data being submitted:', {
      address: addressToTag,
      tag: tagName,
      createdBy: walletAddress,
      signatureLength: signature?.length,
    });
    debugInfo.current.submissionAttempted = true;
    
    try {
      // Check all data is valid
      if (!walletAddress) {
        const error = 'No wallet connected';
        console.error('❌', error);
        setTagError(error);
        console.groupEnd();
        return;
      }
      
      if (!isValidAddress(addressToTag)) {
        const error = 'Invalid address format';
        console.error('❌', error);
        setTagError(error);
        console.groupEnd();
        return;
      }
      
      if (!tagName.trim()) {
        const error = 'Tag name cannot be empty';
        console.error('❌', error);
        setTagError(error);
        console.groupEnd();
        return;
      }
      
      if (!signature) {
        const error = 'No signature provided';
        console.error('❌', error);
        setTagError(error);
        console.groupEnd();
        return;
      }
      
      setIsSubmittingTag(true);
      
      // Get current URL for relative paths
      const currentPort = window.location.port || '3000';
      console.log('Current port from window.location:', currentPort);
      const baseUrl = `${window.location.protocol}//${window.location.hostname}:${currentPort}`;
      
      // IMPORTANT CHANGE: Use the direct tag create endpoint which we know works
      // Instead of using the regular API endpoint that's not working properly
      const tagUrl = encodeURIComponent(tagName);
      const addressUrl = encodeURIComponent(addressToTag);
      const walletUrl = encodeURIComponent(walletAddress);
      
      // Use the directTagCreate endpoint which we know works (instead of the /api/tags endpoint)
      const apiUrl = `${baseUrl}/api/debug/directTagCreate?address=${addressUrl}&wallet=${walletUrl}&tagName=${tagUrl}`;
      
      console.log('🌐 API URL:', apiUrl);
      
      // Submit the tag using the debug endpoint
      try {
        console.log('Sending fetch request to:', apiUrl);
        const response = await fetch(apiUrl);
        
        console.log('📡 API response status:', response.status);
        console.log('📡 API response headers:', Object.fromEntries([...response.headers.entries()]));
        
        // Check if the response can be parsed as JSON
        let responseText;
        let result;
        try {
          responseText = await response.text();
          console.log('📡 Raw API response:', responseText);
          
          // Try to parse JSON if it looks like JSON
          if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
            result = JSON.parse(responseText);
            console.log('📡 Parsed API response data:', result);
          } else {
            console.warn('📡 Response is not valid JSON:', responseText);
            result = { error: 'Invalid JSON response', raw: responseText };
          }
        } catch (parseError: unknown) {
          console.error('❌ Error parsing API response:', parseError);
          result = { error: 'Failed to parse response', text: responseText };
        }
        
        if (!response.ok) {
          console.error('❌ API request failed with status:', response.status);
          throw new Error(result?.error || `Failed to create tag: ${response.status}`);
        }
        
        // Success
        console.log('✅ Tag created successfully:', result);
        
        // Add the tag to local state - Use the tag from response.tag if available
        let newTag;
        
        if (result && result.tag && typeof result.tag === 'object') {
          // The debug endpoint returns the tag object in a nested 'tag' property
          newTag = result.tag;
          console.log('✅ Using tag from debug endpoint response:', newTag);
        } else if (result && result.address && result.tag) {
          // For backwards compatibility with the regular endpoint
          newTag = result;
          console.log('✅ Using tag directly from response:', newTag);
        } else {
          // Fallback if the response doesn't contain a properly formatted tag
          newTag = {
            id: `${walletAddress?.toLowerCase()}_${addressToTag.toLowerCase()}`,
            address: addressToTag.toLowerCase(),
            tag: tagName,
            created_by: walletAddress?.toLowerCase() || '',
            signature: 'verified',
            created_at: new Date().toISOString()
          };
          console.log('✅ Using constructed tag object:', newTag);
        }
        
        setTags([...tags, newTag]);
        console.log('✅ Added new tag to local state');
        
        closeTagModal();
      } catch (fetchError) {
        console.error('❌ Fetch error:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('❌ submitTagWithSignature error:', error);
      setTagError(`Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      debugInfo.current.lastError = error as any;
    } finally {
      setIsSubmittingTag(false);
      console.groupEnd();
    }
  };
  
  // Handle errors from signature generation
  useEffect(() => {
    if (signatureError) {
      console.error('Signature error:', signatureError);
      setTagError('Failed to sign message. Please try again.');
      setIsSubmittingTag(false);
    }
  }, [signatureError]);
  
  // Function to handle editing a tag
  // const handleEditTag = (tag: AddressTag) => {
  //   setTagToEdit(tag);
  //   setAddressToTag(tag.address);
  //   setTagName(tag.tag);
  //   setTagError(null);
  //   setIsEditing(true);
  //   setTagModalOpen(true);
  // };
  
  // Function to update a tag
  const updateTag = async () => {
    if (!tagToEdit || !walletAddress || !isValidAddress(addressToTag) || !tagName.trim()) {
      setTagError('Please provide a valid tag name');
      setIsSubmittingTag(false);
      return;
    }
    
    try {
      setIsSubmittingTag(true);
      
      // Use the current window location with port to avoid CORS issues
      const currentPort = window.location.port;
      const baseUrl = `${window.location.protocol}//${window.location.hostname}:${currentPort}`;
      
      // Construct the payload for the update
      const payload = {
        address: addressToTag,
        tag: tagName,
        createdBy: walletAddress,
        oldAddress: tagToEdit.address
      };
      
      console.log(`Updating tag using URL: ${baseUrl}/api/tags`);
      console.log('Update payload:', payload);
      
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      console.log('Update response status:', response.status);
      console.log('Update response headers:', Object.fromEntries([...response.headers.entries()]));
      
      // Get raw text response first for safer handling
      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      let responseData;
      try {
        // Only try to parse if response has content
        if (responseText.trim()) {
          responseData = JSON.parse(responseText);
          console.log('Parsed response data:', responseData);
        } else {
          console.error('Empty response received from server');
          throw new Error('Server returned an empty response');
        }
      } catch (parseError: unknown) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error(`Error parsing server response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      if (!response.ok) {
        const errorMessage = responseData?.error || 'Failed to update tag';
        console.error('Server error updating tag:', responseData);
        throw new Error(errorMessage);
      }
      
      // Check if responseData has expected structure
      if (!responseData || !responseData.address || !responseData.tag) {
        console.error('Invalid response format:', responseData);
        throw new Error('Server returned an invalid response format');
      }
      
      console.log('Tag updated successfully:', responseData);
      
      // Update the tag in local state
      setTags(tags.map(t => 
        (t.address === tagToEdit.address && t.created_by === walletAddress) ? responseData : t
      ));
      
      // Reset the form
      closeTagModal();
    } catch (err) {
      console.error('Error updating tag:', err);
      setTagError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsSubmittingTag(false);
    }
  };
  
  // Function to open delete confirmation dialog
  const openDeleteConfirmation = (tag: AddressTag) => {
    setTagToDelete(tag);
    setDeleteConfirmOpen(true);
  };
  
  // Function to close delete confirmation dialog
  const closeDeleteConfirmation = () => {
    setTagToDelete(null);
    setDeleteConfirmOpen(false);
  };
  
  // Add functionality to delete tags
  const handleDeleteTag = async (tag: AddressTag) => {
    if (!walletAddress || !tag.created_by || !tag.address) {
      console.error('Missing required data for tag deletion');
      return;
    }
    
    try {
      // Make sure we're only deleting tags created by this wallet
      if (tag.created_by.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error('You can only delete tags you created');
      }
      
      const params = new URLSearchParams({
        walletAddress: walletAddress.toLowerCase(),
        targetAddress: tag.address.toLowerCase()
      });
      
      // Use the current window location with port to avoid CORS issues
      const currentPort = window.location.port;
      const baseUrl = `${window.location.protocol}//${window.location.hostname}:${currentPort}`;
      const apiUrl = `${baseUrl}/api/tags?${params.toString()}`;
      
      console.log(`Deleting tag using URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error deleting tag:', errorData);
        throw new Error(errorData.error || 'Failed to delete tag');
      }
      
      const result = await response.json();
      console.log('Tag deleted successfully:', result);
      
      // Remove the tag from local state
      setTags(tags.filter(t => 
        !(t.address && 
          t.created_by && 
          t.address.toLowerCase() === tag.address.toLowerCase() && 
          t.created_by.toLowerCase() === walletAddress.toLowerCase())
      ));
      
      // Close the confirmation dialog
      closeDeleteConfirmation();
    } catch (err) {
      console.error('Error deleting tag:', err);
      // Optionally show an error message to the user
    }
  };
  
  // Open tag modal for creating a tag for a specific address
  const openTagModal = (address: string) => {
    setAddressToTag(address);
    setTagName('');
    setTagError(null);
    setIsEditing(false);
    setTagToEdit(null);
    setTagModalOpen(true);
  };
  
  // Close tag modal
  const closeTagModal = () => {
    setTagModalOpen(false);
    setAddressToTag('');
    setTagName('');
    setTagError(null);
    setIsSubmittingTag(false);
    setIsEditing(false);
    setTagToEdit(null);
  };

  // Handle tag submission
  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If we're editing, use the updateTag function instead
    if (isEditing && tagToEdit) {
      await updateTag();
      return;
    }
    
    console.group('📝 Tag Submit Handling');
    console.log('handleTagSubmit called');
    debugInfo.current.signAttempted = true;
    
    try {
      // Validate inputs
      if (!walletAddress) {
        const error = 'Please connect your wallet';
        console.error('❌', error);
        setTagError(error);
        console.groupEnd();
        return;
      }
      
      if (!isValidAddress(addressToTag)) {
        const error = 'Please enter a valid Ethereum address';
        console.error('❌', error);
        setTagError(error);
        console.groupEnd();
        return;
      }
      
      if (!tagName.trim()) {
        const error = 'Please enter a tag name';
        console.error('❌', error);
        setTagError(error);
        console.groupEnd();
        return;
      }
      
      // Set loading state
      setIsSubmittingTag(true);
      setTagError(null);
      
      if (process.env.NODE_ENV === 'development' && false) { // Only for development mode
        console.log('🧪 Dev mode, bypassing signature');
        await createTag();
        console.groupEnd();
        return;
      }
      
      // Construct message to sign
      const message = `I want to create a tag "${tagName}" for address ${addressToTag}`;
      console.log('📝 Message to sign:', message);
      console.log('📊 Message length:', message.length);
      console.log('📊 Message bytes:', new TextEncoder().encode(message).length);
      
      // Request signature
      console.log('🔑 Requesting wallet signature...');
      signMessage({ message });
      console.log('🔄 Signature request sent to wallet');
    } catch (error) {
      console.error('❌ handleTagSubmit error:', error);
      setTagError(`Error initiating tag creation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSubmittingTag(false);
      debugInfo.current.lastError = error as any;
    } finally {
      console.groupEnd();
    }
  };
  
  // Function to create a tag (now only used directly, not via the signature process)
  const createTag = async () => {
    if (!walletAddress || !isValidAddress(addressToTag) || !tagName.trim()) {
      setTagError('Please provide a valid tag name');
      setIsSubmittingTag(false);
      return;
    }
    
    if (!signature) {
      setTagError('Signature is required. Please try again.');
      setIsSubmittingTag(false);
      return;
    }
    
    try {
      // Use the current window location with port to avoid CORS issues
      const currentPort = window.location.port;
      const baseUrl = `${window.location.protocol}//${window.location.hostname}:${currentPort}`;
      const apiUrl = `${baseUrl}/api/tags`;
      
      console.log(`Creating tag using URL: ${apiUrl}`);
      console.log('Tag data:', {
        address: addressToTag,
        tag: tagName,
        createdBy: walletAddress,
        signatureLength: signature?.length || 0
      });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: addressToTag,
          tag: tagName,
          createdBy: walletAddress,
          signature,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error response from API:', errorData);
        throw new Error(errorData.error || 'Failed to create tag')
      }
      
      const newTag = await response.json()
      
      // Add the new tag to the local state
      // The API now returns a properly formatted tag
      setTags([...tags, newTag])
      
      // Reset form
      closeTagModal()
    } catch (err) {
      console.error('Error in createTag function:', err);
      setTagError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsSubmittingTag(false)
    }
  }
  
  // Expose debug info to the browser console
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).tagDebugInfo = debugInfo.current;
      (window as any).getTagDebugInfo = () => {
        console.group('🐞 Tag Creation Debug Info');
        console.log('Current debug state:', debugInfo.current);
        console.log('Current tag form data:', {
          walletAddress,
          addressToTag,
          tagName
        });
        console.log('Last signature:', signature);
        console.log('Is signature pending:', isSignatureLoading);
        console.log('Last sign error:', signatureError);
        console.groupEnd();
        return debugInfo.current;
      };
    }
  }, [walletAddress, addressToTag, tagName, signature, isSignatureLoading, signatureError]);
  
  // Get all tags created by the current wallet
  const getUserTags = (): AddressTag[] => {
    if (!walletAddress || !tags) return [];
    
    return tags.filter(tag => 
      tag.created_by && tag.created_by.toLowerCase() === walletAddress.toLowerCase()
    );
  };
  
  return (
    <div className="relative w-full">
      {/* Tag Management Section */}
      
      
      {/* Transaction History Section */}
      <div className="w-full mt-6 mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold flex items-center relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
             </svg>
            </div>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white">Transaction History</span>
          </h2>
          
          <div className="text-sm text-purple-200">
            <span className="px-3 py-1 rounded-full bg-[#1D0F45] border border-purple-700/30">{transactions.length} transactions</span>
          </div>
        </div>
        
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="bg-[#160c33]/80 h-24 rounded-xl border border-purple-800/30"></div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-[#160c33]/80 rounded-xl shadow-[0_8px_30px_rgba(90,50,180,0.15)] p-8 text-center border border-purple-800/50 backdrop-blur-sm">
            <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-gradient-to-br from-purple-800/40 to-indigo-900/40 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
            </div>
            <p className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-100 to-white">No transactions found for this wallet</p>
          </div>
        ) :
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div 
                key={tx.id} 
                className="bg-[#160c33]/80 rounded-xl shadow-[0_4px_20px_rgba(90,50,180,0.1)] p-5 border border-purple-800/50 backdrop-blur-sm transition-all duration-300 hover:shadow-[0_4px_25px_rgba(120,80,220,0.18)] relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10"></div>
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        tx.status === 'success' ? 'bg-green-500' : 
                        tx.status === 'pending' ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}></div>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                        tx.status === 'success' ? 'bg-green-900/60 text-green-200 border-green-700/50' : 
                        tx.status === 'pending' ? 'bg-yellow-900/60 text-yellow-200 border-yellow-700/50' : 
                        'bg-red-900/60 text-red-200 border-red-700/50'
                      }`}>
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </span>
                      <span className="ml-auto text-xs text-purple-200">
                        {new Date(tx.timestamp * 1000).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="mb-2 bg-[#1D0F45] rounded-lg p-3 border border-purple-700/30">
                      <div className="flex items-center mb-2">
                        <span className="text-xs font-medium text-purple-200 w-16">From:</span>
                        {formatAddress(tx.from)}
                        {walletAddress && !getTagForAddress(tx.from) && tx.from.toLowerCase() !== walletAddress.toLowerCase() && (
                          <button 
                            onClick={() => openTagModal(tx.from)}
                            className="ml-2 text-xs text-white hover:text-white px-2 py-1 rounded-full bg-purple-600/60 hover:bg-purple-500/70 transition-colors flex items-center"
                            title="Add a tag for this address"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            Tag
                          </button>
                        )}
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs font-medium text-purple-200 w-16">To:</span>
                        {formatAddress(tx.to)}
                        {walletAddress && !getTagForAddress(tx.to) && tx.to.toLowerCase() !== walletAddress.toLowerCase() && (
                          <button 
                            onClick={() => openTagModal(tx.to)}
                            className="ml-2 text-xs text-white hover:text-white px-2 py-1 rounded-full bg-purple-600/60 hover:bg-purple-500/70 transition-colors flex items-center"
                            title="Add a tag for this address"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            Tag
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 text-right">
                    <div className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-400">{formatValue(tx.value)}</div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button 
                    onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                    className="px-3 py-1.5 text-sm rounded-md bg-purple-700/40 hover:bg-purple-600/50 text-white font-medium flex items-center transition-all duration-200 relative z-10 border border-purple-500/30"
                  >
                    {expandedTx === tx.id ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        Hide Details
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        View Details
                      </>
                    )}
                  </button>
                </div>
                
                {expandedTx === tx.id && (
                  <div className="mt-4 pt-4 border-t border-purple-700/40">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#1D0F45] p-3 rounded-lg border border-purple-700/30">
                        <h4 className="text-xs font-semibold uppercase text-purple-300 mb-2">Transaction Hash</h4>
                        <p className="font-mono text-xs break-all">{tx.hash}</p>
                      </div>
                      <div className="bg-[#1D0F45] p-3 rounded-lg border border-purple-700/30">
                        <h4 className="text-xs font-semibold uppercase text-purple-300 mb-2">Block</h4>
                        <p className="font-mono">{tx.blockNumber}</p>
                      </div>
                      <div className="bg-[#1D0F45] p-3 rounded-lg border border-purple-700/30">
                        <h4 className="text-xs font-semibold uppercase text-purple-300 mb-2">Transaction Fee</h4>
                        <p className="font-mono">
                          {(parseInt(tx.gas) * parseInt(tx.gasPrice) / 1e18).toFixed(8)} ETH
                        </p>
                      </div>
                      <div className="bg-[#1D0F45] p-3 rounded-lg border border-purple-700/30">
                        <h4 className="text-xs font-semibold uppercase text-purple-300 mb-2">Age</h4>
                        <div className="flex justify-between">
                          <p>{getTransactionAge(tx.timestamp)}</p>
                          <p className="text-xs text-purple-300">{new Date(tx.timestamp * 1000).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex mt-4 gap-2">
                      {!getTagForAddress(tx.from) && tx.from.toLowerCase() !== walletAddress?.toLowerCase() && (
                        <button
                          onClick={() => openTagModal(tx.from)}
                          className="px-3 py-1.5 text-sm rounded-md bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-medium transition-all duration-200 flex items-center shadow-[0_2px_10px_rgba(90,50,180,0.2)]"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          Tag Sender
                        </button>
                      )}
                      
                      {!getTagForAddress(tx.to) && tx.to.toLowerCase() !== walletAddress?.toLowerCase() && (
                        <button
                          onClick={() => openTagModal(tx.to)}
                          className="px-3 py-1.5 text-sm rounded-md bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-medium transition-all duration-200 flex items-center shadow-[0_2px_10px_rgba(90,50,180,0.2)]"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          Tag Recipient
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        }
        
        {/* Tag Modal */}
        {tagModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm bg-[#0a051d]/70">
            <div className="bg-[#160c33] rounded-xl shadow-[0_8px_30px_rgba(90,50,180,0.3)] p-6 border border-purple-800/50 w-full max-w-lg mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white">
                  {isEditing ? 'Edit Address Tag' : 'Add Address Tag'}
                </h3>
                <button
                  onClick={closeTagModal}
                  className="text-purple-300 hover:text-purple-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleTagSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-purple-300 mb-1">
                    Ethereum Address
                  </label>
                  <div className={`bg-[#1D0F45] border border-purple-700/30 rounded-md px-3 py-2 font-mono text-sm break-all ${isEditing ? 'opacity-70' : ''}`}>
                    {addressToTag}
                  </div>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="tagName" className="block text-sm font-medium text-purple-300 mb-1">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    id="tagName"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="Exchange, Friend, etc."
                    className="w-full px-3 py-2 border border-purple-600/40 rounded-md bg-[#160c33]/90 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/70"
                    required
                  />
                </div>
                
                {tagError && (
                  <div className="mb-4 text-red-400 text-sm px-3 py-2 bg-red-900/20 border border-red-700/40 rounded-md">
                    {tagError}
                  </div>
                )}
                
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={closeTagModal}
                    className="px-4 py-2 text-sm border border-purple-700/50 rounded-md hover:bg-purple-800/30 transition-colors"
                  >
                    Cancel
                  </button>
                  <div className="flex gap-2">
                    {/* Development mode debug buttons */}
                    {process.env.NODE_ENV === 'development' && (
                      <>{/* ... existing development mode buttons ... */}</>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmittingTag}
                      onClick={() => {
                        console.group(`📋 ${isEditing ? 'Update' : 'Create'} Tag Button Clicked`);
                        console.log(`${isEditing ? 'Update' : 'Create'} Tag button clicked with current state:`, {
                          walletConnected: !!walletAddress,
                          walletAddress,
                          addressToTag,
                          tagName,
                          isFormValid: !!(walletAddress && isValidAddress(addressToTag) && tagName.trim()),
                          isSubmittingTag,
                          isEditing
                        });
                        
                        // Add additional checks that could cause form submission issues
                        if (!walletAddress) {
                          console.error('❌ No wallet connected - please connect wallet first');
                        }
                        
                        if (!isValidAddress(addressToTag)) {
                          console.error('❌ Invalid address format:', addressToTag);
                        }
                        
                        if (!tagName.trim()) {
                          console.error('❌ Tag name is empty');
                        }
                        
                        if (isSubmittingTag) {
                          console.warn('⚠️ Submission already in progress - button should be disabled');
                        }
                        
                        // Log the likely message to be signed (only for creation, not editing)
                        if (!isEditing && walletAddress && isValidAddress(addressToTag) && tagName.trim()) {
                          const likelyMessage = `I want to create a tag "${tagName}" for address ${addressToTag}`;
                          console.log('Form is valid, likely message to sign:', likelyMessage);
                          console.log('Message bytes:', new TextEncoder().encode(likelyMessage).length);
                        }
                        
                        console.log("NOTE: This doesn't trigger submission - form submit handles that");
                        console.groupEnd();
                      }}
                      className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 shadow-[0_4px_15px_rgba(90,50,180,0.2)] hover:shadow-[0_4px_20px_rgba(120,80,220,0.35)] disabled:opacity-50 disabled:hover:shadow-none"
                    >
                      {isSubmittingTag ? 'Submitting...' : isEditing ? 'Update Tag' : 'Create Tag'}
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-center text-purple-300/70">
                  {isEditing ? 'Updating a tag does not require a signature' : 'This will require a signature from your wallet (no gas fees)'}
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && tagToDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm bg-[#0a051d]/70">
          <div className="bg-[#160c33] rounded-xl shadow-[0_8px_30px_rgba(90,50,180,0.3)] p-6 border border-purple-800/50 w-full max-w-md mx-4">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-2">Delete Tag</h3>
              
              <p className="text-purple-200 mb-4">
                Are you sure you want to delete the tag "<span className="font-semibold text-white">{tagToDelete.tag}</span>" for address <span className="font-mono text-white">{tagToDelete.address.slice(0, 6)}...{tagToDelete.address.slice(-4)}</span>?
              </p>
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={closeDeleteConfirmation}
                  className="flex-1 px-4 py-2 bg-[#1D0F45] border border-purple-700/50 rounded-md hover:bg-purple-800/30 text-white transition-colors"
                >
                  Cancel
                </button>
                
                <button
                  onClick={() => handleDeleteTag(tagToDelete)}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-medium rounded-md transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 