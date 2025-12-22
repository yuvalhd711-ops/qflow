import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { queue_id } = await req.json();

    console.log("[notifyTwoBefore] Started for queue_id:", queue_id);

    if (!queue_id) {
      return Response.json({ ok: false, error: "Missing queue_id" }, { status: 200 });
    }

    // שליפת כרטיס בטיפול/נקרא
    const activeTickets = await base44.asServiceRole.entities.Ticket.filter({
      queue_id: queue_id,
      state: { "$in": ["called", "in_service"] }
    });

    let currentTicket = null;
    if (activeTickets && activeTickets.length > 0) {
      // אם יש כמה, קח את האחרון לפי updated_date
      currentTicket = activeTickets.sort((a, b) => 
        new Date(b.updated_date) - new Date(a.updated_date)
      )[0];
      console.log("[notifyTwoBefore] Current ticket found:", currentTicket.id, "seq:", currentTicket.seq);
    } else {
      console.log("[notifyTwoBefore] No current ticket in service");
    }

    // שליפת כרטיסים ממתינים
    const waitingTickets = await base44.asServiceRole.entities.Ticket.filter(
      { queue_id: queue_id, state: "waiting" },
      "seq",
      50
    );

    console.log("[notifyTwoBefore] Waiting tickets count:", waitingTickets.length);
    if (waitingTickets.length > 0) {
      console.log("[notifyTwoBefore] First 3 waiting:", 
        waitingTickets.slice(0, 3).map(t => `seq:${t.seq} phone:${t.customer_phone || 'none'}`).join(", ")
      );
    }

    // זיהוי כרטיס יעד
    let targetTicket = null;

    if (currentTicket) {
      // יש כרטיס בטיפול - היעד הוא הממתין השני
      if (waitingTickets.length >= 2) {
        targetTicket = waitingTickets[1];
      } else {
        console.log("[notifyTwoBefore] Not enough waiting tickets (need 2, have", waitingTickets.length, ")");
        return Response.json({ 
          ok: true, 
          message: "Not enough waiting tickets for notification",
          skipped: true 
        }, { status: 200 });
      }
    } else {
      // אין כרטיס בטיפול - היעד הוא הממתין השלישי
      if (waitingTickets.length >= 3) {
        targetTicket = waitingTickets[2];
      } else {
        console.log("[notifyTwoBefore] Not enough waiting tickets (need 3, have", waitingTickets.length, ")");
        return Response.json({ 
          ok: true, 
          message: "Not enough waiting tickets for notification",
          skipped: true 
        }, { status: 200 });
      }
    }

    console.log("[notifyTwoBefore] Target ticket:", targetTicket.id, "seq:", targetTicket.seq);

    // תנאי שליחה
    if (!targetTicket.customer_phone || targetTicket.customer_phone.trim() === "") {
      console.log("[notifyTwoBefore] Skip: no phone number");
      return Response.json({ 
        ok: true, 
        message: "Target ticket has no phone number",
        skipped: true 
      }, { status: 200 });
    }

    if (targetTicket.two_before_sms_sent === true) {
      console.log("[notifyTwoBefore] Skip: SMS already sent for ticket", targetTicket.id);
      return Response.json({ 
        ok: true, 
        message: "SMS already sent for this ticket",
        skipped: true 
      }, { status: 200 });
    }

    // שליפת שם התור
    const queue = await base44.asServiceRole.entities.Queue.get(queue_id);
    const queueName = queue ? queue.name : "התור";

    // שליחת SMS
    console.log("[notifyTwoBefore] Sending SMS to:", targetTicket.customer_phone);
    
    const smsResult = await base44.asServiceRole.functions.invoke('sendSms', {
      phoneNumber: targetTicket.customer_phone,
      queueName: queueName,
      ticketSeq: targetTicket.seq,
      messageOverride: "כמעט הגענו אליך... יש עוד 2 לקוחות בתור לפניך. כדאי להתחיל להתקדם לכיוון הדלפק",
      msgId: `two-before-${targetTicket.id}`
    });

    console.log("[notifyTwoBefore] SMS result:", smsResult.data);

    // עדכון כרטיס
    await base44.asServiceRole.entities.Ticket.update(targetTicket.id, {
      two_before_sms_sent: true
    });

    console.log("[notifyTwoBefore] SMS sent successfully and ticket updated");

    return Response.json({ 
      ok: true, 
      message: "SMS sent successfully",
      targetTicket: {
        id: targetTicket.id,
        seq: targetTicket.seq,
        phone: targetTicket.customer_phone
      }
    }, { status: 200 });

  } catch (error) {
    console.error("[notifyTwoBefore] Error:", error);
    console.error("[notifyTwoBefore] Stack:", error.stack);
    return Response.json({ 
      ok: false, 
      error: String(error),
      stack: error.stack 
    }, { status: 200 });
  }
});