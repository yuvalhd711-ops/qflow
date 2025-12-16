Deno.serve(async (req) => {
  try {
    const r = await fetch("https://www.simplesms.co.il/webservice/SmsWS.asmx", { method: "GET" });
    const t = await r.text();
    return Response.json({ ok: true, status: r.status, sample: t.slice(0, 200) });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});