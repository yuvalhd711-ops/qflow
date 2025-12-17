/**
 * CLOUDFLARE WORKER - SMS PROXY
 * =============================
 * 
 * קובץ זה מכיל את הקוד המלא של Cloudflare Worker שמשמש כ-proxy לשרת SimpleSMS.
 * 
 * הוראות התקנה:
 * 1. היכנס ל-https://dash.cloudflare.com/
 * 2. לך ל-Workers & Pages
 * 3. לחץ על "Create Application" -> "Create Worker"
 * 4. תן שם: sms-proxy (או כל שם אחר)
 * 5. העתק את הקוד למטה ל-Worker
 * 6. לחץ "Deploy"
 * 7. העתק את ה-URL שקיבלת (למשל: https://sms-proxy.YOUR-SUBDOMAIN.workers.dev)
 * 8. עדכן את WORKER_URL בפונקציית sendSms עם ה-URL שקיבלת
 * 
 * הקוד:
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // Get the payload from Base44
      const payload = await request.json();

      // Forward to SimpleSMS JSON API
      const smsResponse = await fetch('https://simplesms.co.il/webservice/json/smsv2.aspx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await smsResponse.text();
      let responseData;

      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      // Return the response from SimpleSMS with CORS headers
      return new Response(JSON.stringify({
        ok: smsResponse.ok,
        status: smsResponse.status,
        data: responseData,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      return new Response(JSON.stringify({
        ok: false,
        error: error.message,
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};