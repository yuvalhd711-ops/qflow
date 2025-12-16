Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const { phoneNumber, queueName, ticketSeq } = await req.json();

    if (!phoneNumber || !queueName || !ticketSeq) {
      return Response.json(
        { ok: false, error: "Missing required parameters: phoneNumber, queueName, ticketSeq" },
        { status: 400 },
      );
    }

    const username = Deno.env.get("SIMPLYCLUB_USERNAME");
    const encryptPassword = Deno.env.get("SIMPLYCLUB_ENCRYPT_PASSWORD");
    const senderName = Deno.env.get("SIMPLYCLUB_SENDER_NAME");

    if (!username || !encryptPassword || !senderName) {
      return Response.json({ ok: false, error: "SMS service not configured properly" }, { status: 500 });
    }

    const phone = String(phoneNumber).trim().replace(/[^\d]/g, "");
    const msg =
      `שוק העיר\n` +
      `מחלקת ${queueName}\n` +
      `מספר התור שלך: ${ticketSeq}\n\n` +
      `להצטרפות למועדון:\n` +
      `https://s1c.me/shukhair_01`;

    const formData = new URLSearchParams();
    formData.append("UserName", username);
    formData.append("EncryptPassword", encryptPassword);
    formData.append("Subscribers", phone);
    formData.append("Message", msg);              // ✅ נכון
    formData.append("SenderName", senderName);
    formData.append("DeliveryDelayInMinutes", "0");
    formData.append("ExpirationDelayInMinutes", "0");
    formData.append("SendId", `kiosk_${queueName}_${ticketSeq}`); // מונע כפילויות יחסית

    const resp = await fetch("https://www.simplesms.co.il/webservice/SmsWS.asmx/SendSms", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const xml = await resp.text();

    if (!resp.ok) {
      return Response.json({ ok: false, error: `Provider HTTP ${resp.status}`, raw: xml.slice(0, 1500) }, { status: 502 });
    }

    // ✅ בדיקת הצלחה אמיתית
    const ok = /<result>\s*OK\s*<\/result>/i.test(xml);
    const statusMatch = xml.match(/<Status>\s*([^<]+)\s*<\/Status>/i);

    if (!ok) {
      return Response.json({ ok: false, error: "Provider returned failure", raw: xml.slice(0, 1500) }, { status: 502 });
    }

    return Response.json({ ok: true, providerStatus: statusMatch?.[1] ?? null });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
