import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    let clientIP = 'unknown';

    // Try to extract IP from base44-state JWT token
    try {
      const base44State = req.headers.get('base44-state');
      if (base44State) {
        // Decode JWT payload (split by . and decode the middle part)
        const parts = base44State.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          clientIP = payload.client_ip || 'unknown';
        }
      }
    } catch (e) {
      console.log('[checkIPAccess] Failed to extract IP from base44-state:', e.message);
    }

    // Fallback to standard headers if needed
    if (clientIP === 'unknown') {
      const xForwardedFor = req.headers.get('x-forwarded-for');
      const xRealIp = req.headers.get('x-real-ip');
      const cfConnectingIp = req.headers.get('cf-connecting-ip');
      
      clientIP = cfConnectingIp 
        || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : null)
        || xRealIp
        || 'unknown';
    }
    
    console.log(`[checkIPAccess] Client IP: ${clientIP}`);

    // Get all allowed IPs from database using service role
    const allowedIPs = await base44.asServiceRole.entities.AllowedIP.filter({ is_active: true });
    console.log(`[checkIPAccess] Found ${allowedIPs.length} active allowed IPs`);

    // If no IPs are configured, ALLOW access (whitelist disabled)
    if (allowedIPs.length === 0) {
      console.log(`[checkIPAccess] No IPs configured - ALLOWING access`);
      return Response.json({ 
        allowed: true,
        reason: "No IP whitelist configured",
        clientIP 
      });
    }

    // Check if client IP is in the allowed list
    const isAllowed = allowedIPs.some(ip => ip.ip_address === clientIP);

    if (isAllowed) {
      console.log(`[checkIPAccess] IP ${clientIP} is ALLOWED ✓`);
      return Response.json({ 
        allowed: true, 
        reason: "IP is in whitelist",
        clientIP 
      });
    }

    console.log(`[checkIPAccess] IP ${clientIP} is BLOCKED ✗`);
    return Response.json({ 
      allowed: false, 
      reason: "IP not in whitelist",
      clientIP,
      allowedIPs: allowedIPs.map(ip => ip.ip_address)
    });

  } catch (error) {
    console.error("[checkIPAccess] Error:", error.message);
    
    // In case of error, ALLOW access (fail open for usability)
    return Response.json({ 
      allowed: true,
      reason: "Error checking IP - allowing access",
      error: error.message,
      clientIP: 'error'
    });
  }
});