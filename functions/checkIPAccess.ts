import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Try multiple headers to get real client IP
    const xForwardedFor = req.headers.get('x-forwarded-for');
    const xRealIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    const remoteAddr = req.headers.get('remote-addr');
    
    // Log all headers for debugging
    console.log(`[checkIPAccess] Headers:`);
    console.log(`  x-forwarded-for: ${xForwardedFor}`);
    console.log(`  x-real-ip: ${xRealIp}`);
    console.log(`  cf-connecting-ip: ${cfConnectingIp}`);
    console.log(`  remote-addr: ${remoteAddr}`);
    
    // Extract client IP (prioritize CloudFlare, then x-forwarded-for, then x-real-ip)
    let clientIP = cfConnectingIp 
      || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : null)
      || xRealIp
      || remoteAddr
      || 'unknown';
    
    console.log(`[checkIPAccess] Determined Client IP: ${clientIP}`);

    // Get all allowed IPs from database
    const allIPs = await base44.asServiceRole.entities.AllowedIP.list();
    const allowedIPs = allIPs.filter(ip => (ip.data?.is_active !== false && ip.is_active !== false));
    console.log(`[checkIPAccess] Found ${allowedIPs.length} active allowed IPs out of ${allIPs.length} total`);
    console.log(`[checkIPAccess] Allowed IPs:`, allowedIPs.map(ip => ip.data?.ip_address || ip.ip_address));

    // If no IPs are configured, BLOCK access (strict mode)
    if (allowedIPs.length === 0) {
      console.log(`[checkIPAccess] No IPs configured - BLOCKING access (strict whitelist mode)`);
      return Response.json({ 
        allowed: false,
        reason: "No IP whitelist configured - access denied",
        clientIP 
      }, { status: 200 });
    }

    // Check if client IP is in the allowed list
    // Handle both flat and nested data structures
    const isAllowed = allowedIPs.some(ip => {
      const ipAddress = ip.ip_address || ip.data?.ip_address;
      console.log(`[checkIPAccess] Comparing: ${ipAddress} === ${clientIP}`);
      return ipAddress === clientIP;
    });

    if (isAllowed) {
      console.log(`[checkIPAccess] IP ${clientIP} is ALLOWED ✓`);
      return Response.json({ 
        allowed: true, 
        reason: "IP is in whitelist",
        clientIP 
      }, { status: 200 });
    }

    console.log(`[checkIPAccess] IP ${clientIP} is BLOCKED ✗`);
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