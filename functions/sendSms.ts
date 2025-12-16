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

    // Get SimplySMS credentials from secrets
    const username = Deno.env.get("SIMPLYCLUB_USERNAME");
    const encryptPassword = Deno.env.get("SIMPLYCLUB_ENCRYPT_PASSWORD");
    const senderName = Deno.env.get("SIMPLYCLUB_SENDER_NAME");

    if (!username || !encryptPassword || !senderName) {
      return Response.json(
        { ok: false, error: "SMS service not configured properly" },
        { status: 200 }
      );
    }

    // Normalize phone - digits only
    const phone = String(phoneNumber).trim().replace(/[^\d]/g, "");

    // Build message
    const message =
      `שוק העיר\n` +
      `מחלקת ${queueName}\n` +
      `מספר התור שלך: ${ticketSeq}\n\n` +
      `להצטרפות למועדון:\n` +
      `https://s1c.me/shukhair_01`;

    // Build form-urlencoded body - EXACT parameter names from SimplySMS documentation
    const formData = new URLSearchParams({
      UserName: username,
      EncryptPassword: encryptPassword,
      Subscribers: phone,
      Message: message,
      SenderName: senderName,
      DeliveryDelayInMinutes: "0",
      ExpirationDelayInMinutes: "1440",
      SendId: `kiosk_${queueName}_${ticketSeq}_${Date.now()}`
    });

    // Call SimplySMS API - EXACT endpoint from documentation
    const response = await fetch("https://simplesms.co.il/webservice/SmsWS.asmx/SendSms", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    const responseText = await response.text();

    if (!response.ok) {
      return Response.json(
        { ok: false, error: `SimplySMS API error: HTTP ${response.status}`, raw: responseText.slice(0, 500) },
        { status: 200 }
      );
    }

    // SimplySMS returns XML - check for success indicators
    const isSuccess = responseText.includes("<result>OK</result>") || 
                      responseText.includes("<Status>QUEUED</Status>");

    return Response.json({
      ok: isSuccess,
      providerStatus: isSuccess ? "queued" : "unknown",
      raw: responseText.slice(0, 500)
    }, { status: 200 });

  } catch (error) {
    return Response.json(
      { ok: false, error: String(error) },
      { status: 200 }
    );
  }
});