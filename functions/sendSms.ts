Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 200 });
    }

    const { phoneNumber, queueName, ticketSeq, messageOverride, msgId } = await req.json();

    if (!phoneNumber || !queueName || !ticketSeq) {
      return Response.json(
        { ok: false, error: "Missing required parameters: phoneNumber, queueName, ticketSeq" },
        { status: 200 }
      );
    }

    // Get API key for Linux proxy server
    const apiKey = Deno.env.get("SMS_PROXY_KEY");
    if (!apiKey) {
      return Response.json(
        { ok: false, error: "SMS_PROXY_KEY not configured" },
        { status: 200 }
      );
    }

    // Normalize phone - digits only
    const normalizedPhone = String(phoneNumber).trim().replace(/[^\d]/g, "");

    // Build message text
    const defaultMessageText =
      'שוק העיר\n' +
      `מחלקת ${queueName}\n` +
      `מספר התור שלך: ${ticketSeq}\n\n` +
     'אתה כעת יכול להמשיך בקניות בסניף, אנחנו כבר נשלח לך תזכורת כשהתור יתקרב.\n\n' +
     'להצטרפות למועדון:\n' +
     'https://s1c.me/shukhair_01';

    
    const messageText = messageOverride || defaultMessageText;

    // Build payload for Linux proxy
    const payload = {
      Cli: normalizedPhone,
      Text: messageText,
      MsgId: msgId || `kiosk_${queueName}_${ticketSeq}_${Date.now()}`
    };

    // Call Linux SMS proxy server
    const response = await fetch("http://84.110.65.94:2000/send-sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let proxyResponse;

    try {
      proxyResponse = JSON.parse(responseText);
    } catch {
      proxyResponse = { raw: responseText };
    }

    console.log("SMS Proxy Response:", proxyResponse);

    if (response.status === 200) {
      return Response.json({
        ok: true,
        status: response.status,
        proxyResponse
      }, { status: 200 });
    }

    return Response.json({
      ok: false,
      error: `SMS Proxy error: HTTP ${response.status}`,
      status: response.status,
      proxyResponse
    }, { status: 200 });

  } catch (error) {
    return Response.json(
      { ok: false, error: String(error) },
      { status: 200 }
    );
  }
});