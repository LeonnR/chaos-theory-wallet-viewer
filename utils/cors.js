/**
 * CORS (Cross-Origin Resource Sharing) configuration utilities
 */

// Standard CORS headers for APIs
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
};

/**
 * Creates a response object with CORS headers
 * @param {object} data - Response data
 * @param {object} options - Response options (status, headers)
 * @returns {Response} - Response with CORS headers
 */
export function corsResponse(data, options = {}) {
  const { status = 200, headers = {} } = options;
  
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...headers
    }
  });
}

/**
 * Handle CORS preflight requests
 * @returns {Response} - 200 OK response with CORS headers
 */
export function handleCorsPreflightRequest() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}

/**
 * Add CORS headers to existing headers object
 * @param {Headers} headers - Headers object to modify
 * @returns {Headers} - Headers with CORS added
 */
export function addCorsHeaders(headers) {
  const newHeaders = new Headers(headers);
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  
  return newHeaders;
} 