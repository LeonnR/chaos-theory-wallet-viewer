import { verifyMessage } from 'viem';
import { ethers } from 'ethers'; // Keep for backwards compatibility

/**
 * Utility function to validate Ethereum signatures using viem
 * @param {string} message - The original message that was signed
 * @param {string} signature - The signature produced by the wallet
 * @param {string} address - The ethereum address that supposedly signed the message
 * @returns {Promise<object>} - Validation result with success status and details
 */
export async function validateSignature(message, signature, address) {
  try {
    if (!message || !signature || !address) {
      return {
        success: false,
        error: 'Missing required parameters',
        details: { message: !!message, signature: !!signature, address: !!address }
      };
    }
    
    // Log parameters for debugging
    console.log('Validating signature:', {
      messageLength: message.length,
      signatureLength: signature.length,
      addressLength: address.length,
      messagePreview: message.substring(0, 20) + '...',
      signaturePrefix: signature.substring(0, 10) + '...',
      address
    });
    
    let isValid = false;
    let recoveredAddress = null;
    
    // First try with viem
    try {
      isValid = await verifyMessage({
        address,
        message,
        signature,
      });
      
      if (isValid) {
        return {
          success: true,
          verifier: 'viem',
          match: true
        };
      }
    } catch (viemError) {
      console.warn('Viem validation failed, falling back to ethers:', viemError.message);
      
      // Fall back to ethers if viem fails
      try {
        recoveredAddress = ethers.utils.verifyMessage(message, signature);
        isValid = recoveredAddress.toLowerCase() === address.toLowerCase();
        
        return {
          success: isValid,
          verifier: 'ethers',
          recoveredAddress,
          match: isValid,
          error: isValid ? null : 'Recovered address does not match supplied address'
        };
      } catch (ethersError) {
        console.error('Both viem and ethers validation failed:', ethersError.message);
        return {
          success: false,
          error: 'Signature validation failed with both viem and ethers',
          details: { viemError: viemError.message, ethersError: ethersError.message }
        };
      }
    }
    
    return {
      success: false,
      error: 'Unknown validation failure'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack,
      details: { message, signaturePrefix: signature?.substring(0, 10) + '...', address }
    };
  }
}

/**
 * Validates if an address is a valid Ethereum address
 * @param {string} address - Ethereum address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Normalizes an Ethereum address (lowercases and ensures 0x prefix)
 * @param {string} address - Ethereum address
 * @returns {string} - Normalized address
 */
export function normalizeAddress(address) {
  if (!address) return '';
  
  let normalized = address.toLowerCase();
  if (!normalized.startsWith('0x')) {
    normalized = '0x' + normalized;
  }
  
  return normalized;
} 