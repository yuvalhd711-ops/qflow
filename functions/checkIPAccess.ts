import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Try multiple headers to get real client IP
    const xForwardedFor = req.headers.get('x-forwarded-for');
    const xRealIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    const remoteAddr = req.headers.get('remote-addr');
    
    // Extract client IP (prioritize CloudFlare, then x-forwarded-for, then x-real-ip)
    let clientIP = cfConnectingIp 
      || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : null)
      || xRealIp
      || remoteAddr
      || 'unknown';
    
    console.log(`[checkIPAccess] Client IP: ${clientIP} - ALLOWING ACCESS (whitelist disabled)`);

    // Whitelist disabled - allow all access
    return Response.json({ 
      allowed: true, 
      reason: "IP whitelist disabled - all access allowed",
      clientIP 
    }, { status: 200 });

  } catch (error) {
    console.error("[checkIPAccess] Error:", error);
    // In case of error, BLOCK access (fail secure, not fail open)
    return Response.json({ 
      allowed: false,
      reason: "Error checking IP - access denied for security",
      error: error.message,
      clientIP: 'error'
    }, { status: 200 });
  }
});