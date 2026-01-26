import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log("[getCurrentIP] ===== Detecting IP =====");
    
    // Try to get IP from base44-state token first (most reliable)
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
            console.log(`[getCurrentIP] Detected IP: ${payload.client_ip} (from base44-state)`);
            return Response.json({ 
              detectedIP: payload.client_ip,
              source: 'base44-state'
            });
          }
        }
      } catch (e) {
        console.warn('[getCurrentIP] Failed to parse base44-state:', e.message);
      }
    }

    // Fallback: try common headers
    const possibleHeaders = [
      'cf-connecting-ip',
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip'
    ];
    
    for (const header of possibleHeaders) {
      const value = req.headers.get(header);
      if (value) {
        let ip = value;
        if (header === 'x-forwarded-for') {
          ip = value.split(',')[0].trim();
        }
        console.log(`[getCurrentIP] Detected IP: ${ip} (from ${header})`);
        return Response.json({ 
          detectedIP: ip,
          source: header
        });
      }
    }

    // No IP detected
    console.log('[getCurrentIP] No IP detected');
    return Response.json({ 
      detectedIP: null,
      source: null,
      error: 'Could not detect IP address'
    }, { status: 400 });

  } catch (error) {
    console.error("[getCurrentIP] Error:", error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});