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
    
    console.log(`[checkIPAccess] Client IP: ${clientIP}`);

    // Get all allowed IPs from database
    const allIPs = await base44.asServiceRole.entities.AllowedIP.list();
    console.log(`[checkIPAccess] Total IPs in DB: ${allIPs.length}`);
    
    const allowedIPs = allIPs.filter(ip => {
      // Support both flat and nested data structures
      const isActive = (ip.is_active !== undefined) ? ip.is_active : (ip.data?.is_active !== false);
      const ipAddress = ip.ip_address || ip.data?.ip_address;
      console.log(`[checkIPAccess] IP Record:`, { ipAddress, isActive, rawIP: ip });
      return isActive && ipAddress;
    });
    
    console.log(`[checkIPAccess] Active IPs: ${allowedIPs.length}`);

    // If no IPs are configured, BLOCK access
    if (allowedIPs.length === 0) {
      console.log(`[checkIPAccess] No active IPs - BLOCKING`);
      return Response.json({ 
        allowed: false,
        reason: "No IP whitelist configured",
        clientIP 
      }, { status: 200 });
    }

    // Check if client IP is in the allowed list
    const isAllowed = allowedIPs.some(ip => {
      const ipAddress = ip.ip_address || ip.data?.ip_address;
      const match = ipAddress === clientIP;
      console.log(`[checkIPAccess] ${ipAddress} === ${clientIP}? ${match}`);
      return match;
    });

    if (isAllowed) {
      console.log(`[checkIPAccess] ✓ ALLOWED`);
      return Response.json({ 
        allowed: true, 
        reason: "IP in whitelist",
        clientIP 
      }, { status: 200 });
    }

    console.log(`[checkIPAccess] ✗ BLOCKED`);
    return Response.json({ 
      allowed: false, 
      reason: "IP not in whitelist",
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