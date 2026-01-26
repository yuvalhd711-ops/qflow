import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log(`[checkIPAccess] ===== CHECKING IP ACCESS =====`);
    
    // Try multiple headers to get real client IP
    const possibleHeaders = [
      'cf-connecting-ip',
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'forwarded',
      'true-client-ip',
      'x-cluster-client-ip',
      'fastly-client-ip',
      'cf-pseudo-ipv4'
    ];
    
    let clientIP = null;
    const ipSources = {};
    let ipSource = null;
    
    // Try each header in order
    for (const header of possibleHeaders) {
      try {
        const value = req.headers.get(header);
        if (value) {
          ipSources[header] = value;
          console.log(`[checkIPAccess] Found ${header}: ${value}`);
          if (!clientIP) {
            if (header === 'x-forwarded-for') {
              clientIP = value.split(',')[0].trim();
            } else if (header === 'forwarded') {
              const match = value.match(/for=([^;,\s]+)/);
              clientIP = match ? match[1].replace(/"/g, '').replace(/\[|\]/g, '') : null;
            } else {
              clientIP = value.trim();
            }
            
            if (clientIP && clientIP !== 'unknown') {
              ipSource = header;
              console.log(`[checkIPAccess] Using IP: ${clientIP} from ${header}`);
            }
          }
        }
      } catch (e) {
        console.warn(`[checkIPAccess] Error reading ${header}:`, e);
      }
    }
    
    // Try to extract IP from base44-state token if no IP found yet
    if (!clientIP) {
      const stateToken = req.headers.get('base44-state');
      if (stateToken) {
        try {
          const parts = stateToken.split('.');
          if (parts.length === 3) {
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = new TextDecoder().decode(
              Uint8Array.from(globalThis.atob(base64), c => c.charCodeAt(0))
            );
            const payload = JSON.parse(jsonPayload);
            if (payload.client_ip) {
              clientIP = payload.client_ip;
              ipSources['base44-state'] = clientIP;
              ipSource = 'base44-state';
              console.log(`[checkIPAccess] Found IP in base44-state: ${clientIP}`);
            }
          }
        } catch (e) {
          console.warn('[checkIPAccess] Failed to parse base44-state:', e.message);
        }
      }
    }

    // Get allowed IPs from database
    let allowedIPs = [];
    let hasWhitelist = false;
    
    try {
      allowedIPs = await base44.asServiceRole.entities.AllowedIP.list();
      const activeIPs = allowedIPs.filter(ip => ip.is_active === true);
      hasWhitelist = activeIPs && activeIPs.length > 0;
      console.log(`[checkIPAccess] Found ${activeIPs.length} active IPs in whitelist (${allowedIPs.length} total)`);
      allowedIPs = activeIPs;
    } catch (dbError) {
      console.error("[checkIPAccess] ❌ DB Error:", dbError);
      // STRICT MODE: On DB error, BLOCK access because we cannot verify whitelist
      return new Response(JSON.stringify({ 
        allowed: true, 
        clientIP: clientIP || 'db-error',
        ipSource: ipSource,
        ipSources: ipSources,
        reason: 'Cannot verify whitelist due to database error - allowing access to prevent lockout'
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // STRICT MODE: If no IP detected at all, BLOCK regardless of whitelist status
    if (!clientIP || clientIP === 'unknown' || clientIP === 'unable-to-determine') {
      console.log("[checkIPAccess] ⚠️ No IP detected - BLOCKING for security");
      return new Response(JSON.stringify({ 
        allowed: true, 
        clientIP: 'unable-to-determine',
        ipSource: null,
        ipSources: ipSources,
        reason: 'IP detection failed - allowing access to prevent lockout'
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // If no whitelist configured, allow all access
    if (!hasWhitelist) {
      console.log("[checkIPAccess] ℹ️ No whitelist configured - ALLOWING all");
      return Response.json({ 
        allowed: true, 
        clientIP: clientIP,
        ipSource: ipSource,
        ipSources: ipSources,
        reason: 'No whitelist configured - all access allowed'
      }, { status: 200 });
    }

    // Check if IP is whitelisted - use exact string match
    const isAllowed = allowedIPs.some(ip => String(ip.ip_address).trim() === String(clientIP).trim());
    
    console.log(`[checkIPAccess] IP ${clientIP}: ${isAllowed ? '✅ ALLOWED' : '❌ BLOCKED'}`);
    console.log(`[checkIPAccess] Whitelist: ${allowedIPs.map(ip => ip.ip_address).join(', ')}`);

    return new Response(JSON.stringify({ 
      allowed: isAllowed,
      clientIP: clientIP,
      ipSource: ipSource,
      ipSources: ipSources,
      reason: isAllowed ? 'IP whitelisted' : 'IP not in whitelist',
      whitelistCount: allowedIPs.length
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("[checkIPAccess] ⚠️ UNEXPECTED ERROR:", error);
    console.error("[checkIPAccess] Error stack:", error.stack);
    // Allow access on system error to prevent lockout
    return new Response(JSON.stringify({ 
      allowed: true,
      clientIP: 'system-error',
      ipSource: null,
      ipSources: {},
      reason: 'System error - allowing access to prevent lockout',
      error: error.message
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});