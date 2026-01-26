import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log("[checkIPAccess] ===== Checking IP Access =====");
    
    // Get client IP from base44-state token
    let clientIP = null;
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
          clientIP = payload.client_ip;
        }
      } catch (e) {
        console.warn('[checkIPAccess] Failed to parse base44-state:', e.message);
      }
    }
    
    // Fallback to headers if no IP from token
    if (!clientIP) {
      const possibleHeaders = ['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip', 'x-client-ip'];
      for (const header of possibleHeaders) {
        const value = req.headers.get(header);
        if (value) {
          clientIP = header === 'x-forwarded-for' ? value.split(',')[0].trim() : value;
          break;
        }
      }
    }

    console.log(`[checkIPAccess] Client IP: ${clientIP}`);

    // Get allowed IPs from database
    const allowedIPs = await base44.asServiceRole.entities.AllowedIP.filter({ is_active: true });
    
    console.log(`[checkIPAccess] Found ${allowedIPs.length} active allowed IPs`);

    // If no whitelist configured, block all access
    if (allowedIPs.length === 0) {
      console.log("[checkIPAccess] ❌ No whitelist configured - BLOCKING access");
      return Response.json({ 
        allowed: false,
        clientIP: clientIP,
        reason: 'No IP whitelist configured - access blocked'
      });
    }

    // If no IP detected, block access
    if (!clientIP) {
      console.log("[checkIPAccess] ❌ No IP detected - BLOCKING access");
      return Response.json({ 
        allowed: false,
        clientIP: null,
        reason: 'Could not detect client IP - access blocked'
      });
    }

    // Check if IP is in whitelist
    const isAllowed = allowedIPs.some(ip => ip.ip_address === clientIP);
    
    if (isAllowed) {
      console.log(`[checkIPAccess] ✅ IP ${clientIP} is ALLOWED`);
    } else {
      console.log(`[checkIPAccess] ❌ IP ${clientIP} is BLOCKED`);
    }

    return Response.json({ 
      allowed: isAllowed,
      clientIP: clientIP,
      reason: isAllowed ? 'IP is whitelisted' : 'IP not in whitelist'
    });

  } catch (error) {
    console.error("[checkIPAccess] Error:", error);
    // On error, block access for security
    return Response.json({ 
      allowed: false,
      clientIP: null,
      reason: 'System error - access blocked',
      error: error.message
    }, { status: 500 });
  }
});