import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Log ALL headers for debugging
    console.log(`[getCurrentIP] ===== ALL REQUEST HEADERS =====`);
    const allHeaders = {};
    for (const [key, value] of req.headers.entries()) {
      console.log(`  ${key}: ${value}`);
      allHeaders[key] = value;
    }
    console.log(`[getCurrentIP] ================================`);
    
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
    
    if (!clientIP) {
      clientIP = 'unable-to-determine';
    }
    
    return Response.json({ 
      detectedIP: clientIP,
      allIPSources: ipSources,
      allHeaders: allHeaders
    }, { status: 200 });

  } catch (error) {
    console.error("[getCurrentIP] Error:", error);
    return Response.json({ 
      error: error.message,
      detectedIP: 'error'
    }, { status: 500 });
  }
});