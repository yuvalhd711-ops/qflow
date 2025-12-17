Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 200 });
    }

    // Get input from Kiosk: to, department, queueNumber, link, msgId (optional)
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

    // Build payload according to OpenAPI schema - EXACT field names
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

    // Call SimpleSMS JSON API - PRIMARY SERVER (no whitelist needed)
    const apiUrl = "https://simplesms.co.il/webservice/json/smsv2.aspx";
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let providerResponse;

    try {
      providerResponse = JSON.parse(responseText);
    } catch {
      providerResponse = { raw: responseText };
    }

    // Handle HTTP status codes according to documentation
    if (response.status === 404) {
      return Response.json({
        ok: false,
        error: "Authentication failed - user/pass incorrect or IP not whitelisted",
        status: 404,
        providerResponse
      }, { status: 200 });
    }

    if (response.status === 502) {
      return Response.json({
        ok: false,
        error: "SenderName is empty",
        status: 502,
        providerResponse
      }, { status: 200 });
    }

    if (response.status === 503) {
      return Response.json({
        ok: false,
        error: "SenderName too long (max 11 chars)",
        status: 503,
        providerResponse
      }, { status: 200 });
    }

    if (response.status === 505) {
      return Response.json({
        ok: false,
        error: "Delivery/Expiration delay invalid",
        status: 505,
        providerResponse
      }, { status: 200 });
    }

    if (response.status === 506) {
      return Response.json({
        ok: false,
        error: "SenderName not approved or invalid",
        status: 506,
        providerResponse
      }, { status: 200 });
    }

    if (!response.ok) {
      return Response.json({
        ok: false,
        error: `SimpleSMS JSON API error: HTTP ${response.status}`,
        status: response.status,
        providerResponse
      }, { status: 200 });
    }

    // Success
    return Response.json({
      ok: true,
      status: response.status,
      providerResponse
    }, { status: 200 });

  } catch (error) {
    return Response.json(
      { ok: false, error: String(error) },
      { status: 200 }
    );
  }
});