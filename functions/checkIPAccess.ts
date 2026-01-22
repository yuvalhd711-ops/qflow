import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get user's IP address from request headers
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
                  || req.headers.get('x-real-ip') 
                  || 'unknown';

    console.log(`[checkIPAccess] Client IP: ${clientIP}`);

    // Get all allowed IPs from database
    const allowedIPs = await base44.asServiceRole.entities.AllowedIP.filter({ is_active: true });

    console.log(`[checkIPAccess] Found ${allowedIPs.length} active allowed IPs`);

    // If no IPs are configured, allow access (whitelist disabled)
    if (allowedIPs.length === 0) {
      console.log(`[checkIPAccess] No IPs configured - access allowed`);
      return Response.json({ 
        allowed: true, 
        reason: "No IP restrictions configured",
        clientIP 
      }, { status: 200 });
    }

    // Check if client IP is in the allowed list
    const isAllowed = allowedIPs.some(ip => ip.ip_address === clientIP);

    if (isAllowed) {
      console.log(`[checkIPAccess] IP ${clientIP} is allowed`);
      return Response.json({ 
        allowed: true, 
        reason: "IP is in whitelist",
        clientIP 
      }, { status: 200 });
    }

    console.log(`[checkIPAccess] IP ${clientIP} is NOT allowed`);
    return Response.json({ 
      allowed: false, 
      reason: "IP not in whitelist",
      clientIP 
    }, { status: 200 });

  } catch (error) {
    console.error("[checkIPAccess] Error:", error);
    return Response.json({ 
      allowed: true, // Fail open - don't lock users out if there's an error
      reason: "Error checking IP",
      error: error.message 
    }, { status: 200 });
  }
});