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
      allowedIPs = await base44.asServiceRole.entities.AllowedIP.filter({ is_active: true });
      hasWhitelist = allowedIPs && allowedIPs.length > 0;
      console.log(`[checkIPAccess] Found ${allowedIPs.length} allowed IPs in whitelist`);
    } catch (dbError) {
      console.error("[checkIPAccess] ❌ DB Error:", dbError);
      // On DB error, allow access to prevent lockout of admins
      return Response.json({ 
        allowed: true, 
        clientIP: clientIP || 'db-error',
        ipSource: ipSource,
        ipSources: ipSources,
        reason: 'Database error - allowing access for safety'
      }, { status: 200 });
    }
    
    // If no whitelist configured, allow all access
    if (!hasWhitelist) {
      console.log("[checkIPAccess] ℹ️ No whitelist configured - ALLOWING all");
      return Response.json({ 
        allowed: true, 
        clientIP: clientIP || 'no-whitelist',
        ipSource: ipSource,
        ipSources: ipSources,
        reason: 'No whitelist configured - all access allowed'
      }, { status: 200 });
    }

    // If whitelist exists but no IP detected - BLOCK
    if (!clientIP || clientIP === 'unknown') {
      console.log("[checkIPAccess] ⚠️ Whitelist active but no IP detected - BLOCKING");
      return Response.json({ 
        allowed: false, 
        clientIP: 'unable-to-determine',
        ipSource: null,
        ipSources: ipSources,
        reason: 'IP detection failed with active whitelist - access denied'
      }, { status: 200 });
    }

    // Check if IP is whitelisted
    const isAllowed = allowedIPs.some(ip => ip.ip_address === clientIP);
    
    console.log(`[checkIPAccess] IP ${clientIP}: ${isAllowed ? '✅ ALLOWED' : '❌ BLOCKED'}`);
    console.log(`[checkIPAccess] Whitelist: ${allowedIPs.map(ip => ip.ip_address).join(', ')}`);

    return Response.json({ 
      allowed: isAllowed,
      clientIP: clientIP,
      ipSource: ipSource,
      ipSources: ipSources,
      reason: isAllowed ? 'IP whitelisted' : 'IP not in whitelist',
      whitelistCount: allowedIPs.length
    }, { status: 200 });

  } catch (error) {
    console.error("[checkIPAccess] ⚠️ UNEXPECTED ERROR:", error);
    console.error("[checkIPAccess] Error stack:", error.stack);
    // On system error, allow access to prevent complete lockout
    return Response.json({ 
      allowed: true,
      clientIP: 'system-error',
      ipSource: null,
      ipSources: {},
      reason: 'System error - allowing access for safety',
      error: error.message
    }, { status: 200 });
  }
});