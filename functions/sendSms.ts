Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 200 });
    }

    // Get input from Kiosk: phoneNumber, queueName, ticketSeq
    const { phoneNumber, queueName, ticketSeq } = await req.json();

    if (!phoneNumber || !queueName || !ticketSeq) {
      return Response.json(
        { ok: false, error: "Missing required parameters: phoneNumber, queueName, ticketSeq" },
        { status: 200 }
      );
    }

    // Get SimpleSMS JSON API credentials from secrets
    const username = Deno.env.get("TELEMESSER_USERNAME");
    const encryptPassword = Deno.env.get("TELEMESSER_ENCRYPT_PASSWORD");
    const senderName = Deno.env.get("TELEMESSER_SENDERNAME");

    if (!username || !encryptPassword || !senderName) {
      return Response.json(
        { ok: false, error: "SMS JSON API not configured - missing TELEMESSER credentials" },
        { status: 200 }
      );
    }

    // Normalize phone - digits only
    const normalizedPhone = String(phoneNumber).trim().replace(/[^\d]/g, "");

    // Build message text
    const messageText =
      `שוק העיר\n` +
      `מחלקת ${queueName}\n` +
      `מספר התור שלך: ${ticketSeq}\n\n` +
      `להצטרפות למועדון:\n` +
      `https://s1c.me/shukhair_01`;

    // Build payload according to SimpleSMS OpenAPI schema
    const payload = {
      Credentials: {
        UserName: username,
        EncryptPassword: encryptPassword
      },
      SenderName: senderName,
      DeliveryDelayInMinutes: 0,
      ExpirationDelayInMinutes: 300,
      SendId: "QueueKiosk",
      messages: [
        {
          Cli: normalizedPhone,
          Text: messageText,
          MsgId: `kiosk_${queueName}_${ticketSeq}_${Date.now()}`
        }
      ]
    };

    // ===== CLOUDFLARE WORKER PROXY =====
    // TODO: Replace this URL with your actual Cloudflare Worker URL after deployment
    // See CLOUDFLARE_WORKER_SMS_PROXY.js for deployment instructions
    const WORKER_URL = "https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev";
    
    // Call Cloudflare Worker instead of SimpleSMS directly
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.ok) {
      return Response.json({
        ok: false,
        error: result.error || "SMS sending failed",
        status: result.status,
        data: result.data
      }, { status: 200 });
    }

    // Success
    return Response.json({
      ok: true,
      status: result.status,
      data: result.data
    }, { status: 200 });

  } catch (error) {
    return Response.json(
      { ok: false, error: String(error) },
      { status: 200 }
    );
  }
});