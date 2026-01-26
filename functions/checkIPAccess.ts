import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Log ALL headers for debugging
    console.log(`[checkIPAccess] ===== ALL REQUEST HEADERS =====`);
    for (const [key, value] of req.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    console.log(`[checkIPAccess] ================================`);
    
    // Try multiple headers to get real client IP
    const possibleHeaders = [
      'cf-connecting-ip',       // CloudFlare
      'x-forwarded-for',        // Most common proxy header
      'x-real-ip',              // Nginx proxy
      'x-client-ip',            // Other proxies
      'forwarded',              // RFC 7239
      'true-client-ip',         // Akamai, CloudFlare Enterprise
      'x-cluster-client-ip',    // Rackspace LB
      'fastly-client-ip',       // Fastly CDN
      'cf-pseudo-ipv4'          // CloudFlare IPv4 fallback
    ];
    
    let clientIP = null;
    
    // Try each header in order
    for (const header of possibleHeaders) {
      const value = req.headers.get(header);
      if (value) {
        console.log(`[checkIPAccess] Found IP in ${header}: ${value}`);
        if (header === 'x-forwarded-for') {
          // Take first IP from comma-separated list
          clientIP = value.split(',')[0].trim();
        } else if (header === 'forwarded') {
          // Parse RFC 7239 format
          const match = value.match(/for=([^;,\s]+)/);
          clientIP = match ? match[1].replace(/"/g, '') : null;
        } else {
          clientIP = value.trim();
        }
        
        if (clientIP && clientIP !== 'unknown' && clientIP.length > 0) {
          console.log(`[checkIPAccess] Selected client IP from ${header}: ${clientIP}`);
          break;
        }
      }
    }
    
    // Fallback to connection info
    if (!clientIP || clientIP === 'unknown') {
      const connInfo = Deno.serveHttp ? (req as any).conn?.remoteAddr : null;
      if (connInfo?.hostname) {
        clientIP = connInfo.hostname;
        console.log(`[checkIPAccess] Using connection remote addr: ${clientIP}`);
      }
    }
    
    // Final fallback
    if (!clientIP || clientIP === 'unknown') {
      clientIP = 'unable-to-determine';
      console.log(`[checkIPAccess] WARNING: Unable to determine client IP!`);
    }
    
    console.log(`[checkIPAccess] Final determined Client IP: ${clientIP}`);

    // Get all allowed IPs from database
    const allowedIPs = await base44.asServiceRole.entities.AllowedIP.filter({ is_active: true });
    console.log(`[checkIPAccess] Found ${allowedIPs.length} active allowed IPs`);

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
    const isAllowed = allowedIPs.some(ip => ip.ip_address === clientIP);

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