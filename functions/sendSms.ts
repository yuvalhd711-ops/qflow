Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 200 });
    }

    const { phoneNumber, queueName, ticketSeq } = await req.json();

    if (!phoneNumber || !queueName || !ticketSeq) {
      return Response.json(
        { ok: false, error: "Missing required parameters: phoneNumber, queueName, ticketSeq" },
        { status: 200 }
      );
    }

    // N8N webhook URL
    const n8nWebhookUrl = Deno.env.get("n8n");
    
    if (!n8nWebhookUrl) {
      return Response.json(
        { ok: false, error: "N8N webhook URL not configured" },
        { status: 200 }
      );
    }

    // Secrets for SimplySMS (will be used by N8N)
    const username = Deno.env.get("SIMPLYCLUB_USERNAME");
    const encryptPassword = Deno.env.get("SIMPLYCLUB_ENCRYPT_PASSWORD");
    const senderName = Deno.env.get("SIMPLYCLUB_SENDER_NAME");

    if (!username || !encryptPassword || !senderName) {
      return Response.json(
        { ok: false, error: "SMS service not configured properly" },
        { status: 200 }
      );
    }

    // Normalize phone
    const phone = String(phoneNumber).trim().replace(/[^\d]/g, "");

    // Message
    const message =
      `שוק העיר\n` +
      `מחלקת ${queueName}\n` +
      `מספר התור שלך: ${ticketSeq}\n\n` +
      `להצטרפות למועדון:\n` +
      `https://s1c.me/shukhair_01`;

    // Call N8N webhook with all the data
    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        encryptPassword,
        senderName,
        phone,
        message,
        sendId: `kiosk_${queueName}_${ticketSeq}`
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      return Response.json(
        { ok: false, error: `N8N webhook error: HTTP ${response.status}`, raw: responseText.slice(0, 1500) },
        { status: 200 }
      );
    }

    // Try to parse the response
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      // If not JSON, assume success if status is OK
      return Response.json({
        ok: true,
        providerStatus: "sent",
      }, { status: 200 });
    }

    // Return the result from N8N
    return Response.json({
      ok: result.ok !== false,
      providerStatus: result.status || result.providerStatus || null,
      details: result.details || null
    }, { status: 200 });

  } catch (error) {
    return Response.json(
      { ok: false, error: String(error) },
      { status: 200 }
    );
  }
});