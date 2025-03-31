import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware handles CORS for API routes
export function middleware(request: NextRequest) {
  // Get the origin from the request headers
  const origin = request.headers.get('origin') || '*';
  
  // Check if this is an API request
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // For OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400', // 24 hours
        },
      });
    }
    
    // For all other requests, add CORS headers to the response
    const response = NextResponse.next();
    
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;
  }
  
  // For non-API routes, just proceed normally
  return NextResponse.next();
}

// Configure which paths this middleware applies to
export const config = {
  matcher: [
    // Apply to all API routes
    '/api/:path*',
  ],
}; 