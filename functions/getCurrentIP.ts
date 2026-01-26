import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log(`[getCurrentIP] ===== Detecting IP =====`);
    
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
    
    const ipSources = {};
    let clientIP = null;
    
    // Try each header in order
    for (const header of possibleHeaders) {
      const value = req.headers.get(header);
      if (value) {
        ipSources[header] = value;
        if (!clientIP) {
          if (header === 'x-forwarded-for') {
            clientIP = value.split(',')[0].trim();
          } else if (header === 'forwarded') {
            const match = value.match(/for=([^;,\s]+)/);
            clientIP = match ? match[1].replace(/"/g, '') : null;
          } else {
            clientIP = value.trim();
          }
        }
      }
    }
    
    // Try to extract IP from base44-state token (Base44 platform specific)
    if (!clientIP) {
      const stateToken = req.headers.get('base44-state');
      if (stateToken) {
        try {
          // Decode JWT without verification (it's already verified by platform)
          const parts = stateToken.split('.');
          if (parts.length === 3) {
            // Use TextDecoder for proper base64 decoding in Deno
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = new TextDecoder().decode(
              Uint8Array.from(globalThis.atob(base64), c => c.charCodeAt(0))
            );
            const payload = JSON.parse(jsonPayload);
            if (payload.client_ip) {
              clientIP = payload.client_ip;
              ipSources['base44-state'] = clientIP;
              console.log(`[getCurrentIP] Found IP in base44-state: ${clientIP}`);
            }
          }
        } catch (e) {
          console.warn('[getCurrentIP] Failed to parse base44-state:', e.message);
        }
      }
    }
    
    if (!clientIP) {
      clientIP = 'unable-to-determine';
    }
    
    console.log(`[getCurrentIP] Final detected IP: ${clientIP}`);
    
    return Response.json({ 
      detectedIP: clientIP,
      allIPSources: ipSources
    }, { status: 200 });

  } catch (error) {
    console.error("[getCurrentIP] Error:", error);
    return Response.json({ 
      error: error.message,
      detectedIP: 'error'
    }, { status: 500 });
  }
});