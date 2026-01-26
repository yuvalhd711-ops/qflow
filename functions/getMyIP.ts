Deno.serve(async (req) => {
  try {
    // Try multiple headers to get real client IP
    const xForwardedFor = req.headers.get('x-forwarded-for');
    const xRealIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    
    // Extract client IP
    const clientIP = cfConnectingIp 
      || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : null)
      || xRealIp
      || 'unknown';

    // Log all headers for debugging
    const allHeaders = {};
    req.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });

    return Response.json({ 
      clientIP,
      headers: allHeaders,
      xForwardedFor,
      xRealIp,
      cfConnectingIp
    });
  } catch (error) {
    return Response.json({ error: error.message });
  }
});