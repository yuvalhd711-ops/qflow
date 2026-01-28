import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log("\n========== IP CHECK START ==========");
    
    // Try multiple headers to get real client IP
    const xForwardedFor = req.headers.get('x-forwarded-for');
    const xRealIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    const remoteAddr = req.headers.get('remote-addr');
    
    console.log(`[1] Headers: x-forwarded-for=${xForwardedFor}, x-real-ip=${xRealIp}, cf-connecting-ip=${cfConnectingIp}, remote-addr=${remoteAddr}`);
    
    // Extract client IP (prioritize CloudFlare, then x-forwarded-for, then x-real-ip)
    let clientIP = cfConnectingIp 
      || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : null)
      || xRealIp
      || remoteAddr
      || 'unknown';
    
    console.log(`[2] Raw clientIP: "${clientIP}" (type: ${typeof clientIP})`);
    
    // Clean IP - remove port if exists
    if (clientIP.includes(':')) {
      const beforeColon = clientIP.split(':')[0];
      console.log(`[3] IP contains port - before colon: "${beforeColon}"`);
      clientIP = beforeColon;
    }
    
    // Trim whitespace
    clientIP = String(clientIP).trim();
    console.log(`[4] Cleaned clientIP: "${clientIP}" (type: ${typeof clientIP})`);

    // Fetch allowed IPs from database using service role to bypass RLS
    console.log(`[5] Fetching AllowedIP records...`);
    const allowedIPs = await base44.asServiceRole.entities.AllowedIP.filter({});
    console.log(`[6] Found ${allowedIPs.length} records in AllowedIP entity`);
    
    // Log each record in detail
    allowedIPs.forEach((record, idx) => {
      const data = record.data || record;
      console.log(`[7.${idx}] Record ${idx + 1}:`);
      console.log(`  - ip_address: "${data.ip_address}" (type: ${typeof data.ip_address})`);
      console.log(`  - is_active: ${data.is_active} (type: ${typeof data.is_active})`);
      console.log(`  - description: "${data.description || 'N/A'}"`);
      console.log(`  - Full record:`, JSON.stringify(record));
    });

    // If no IPs in whitelist, block all access for security
    if (allowedIPs.length === 0) {
      console.log(`[8] ✗ BLOCKED - No IPs in whitelist, blocking all access`);
      console.log("========== IP CHECK END (BLOCKED - EMPTY LIST) ==========\n");
      return Response.json({ 
        allowed: false,
        reason: "No IPs in whitelist - all access blocked",
        clientIP 
      }, { status: 403 });
    }

    // Check if client IP is in the allowed list and is active
    console.log(`[9] Starting IP matching...`);
    const matchingIP = allowedIPs.find((record, idx) => {
      // Extract data (handle both direct fields and data wrapper)
      const data = record.data || record;
      
      // Clean record IP
      const recordIP = String(data.ip_address || '').trim();
      
      // Check is_active (handle multiple formats)
      const isActive = data.is_active === true 
        || data.is_active === 1 
        || data.is_active === "true"
        || data.is_active === "1";
      
      console.log(`[9.${idx}] Comparing:`);
      console.log(`  - Client: "${clientIP}"`);
      console.log(`  - Record: "${recordIP}"`);
      console.log(`  - Match: ${recordIP === clientIP}`);
      console.log(`  - Active: ${isActive} (raw: ${data.is_active})`);
      
      const matches = recordIP === clientIP && isActive;
      console.log(`  - Result: ${matches ? "✓ MATCH" : "✗ NO MATCH"}`);
      
      return matches;
    });

    if (matchingIP) {
      console.log(`[10] ✓✓✓ ALLOWED - IP ${clientIP} found in whitelist and is active`);
      console.log("========== IP CHECK END (ALLOWED) ==========\n");
      return Response.json({ 
        allowed: true, 
        reason: "IP address is whitelisted",
        clientIP 
      }, { status: 200 });
    } else {
      console.log(`[10] ✗✗✗ BLOCKED - IP ${clientIP} NOT in whitelist or not active`);
      console.log("========== IP CHECK END (BLOCKED) ==========\n");
      return Response.json({ 
        allowed: false,
        reason: "IP address not in whitelist or not active",
        clientIP 
      }, { status: 403 });
    }

  } catch (error) {
    console.error("[ERROR] Exception in checkIPAccess:", error);
    console.error("[ERROR] Stack:", error.stack);
    // In case of error, BLOCK access (fail secure, not fail open)
    return Response.json({ 
      allowed: false,
      reason: "Error checking IP - access denied for security",
      error: error.message,
      clientIP: 'error'
    }, { status: 403 });
  }
});