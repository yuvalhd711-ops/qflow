import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { queue_id } = await req.json();

    console.log("[debugTwoBefore] Started for queue_id:", queue_id);

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
      currentTicket = activeTickets.sort((a, b) => 
        new Date(b.updated_date) - new Date(a.updated_date)
      )[0];
    }

    // שליפת כרטיסים ממתינים
    const waitingTickets = await base44.asServiceRole.entities.Ticket.filter(
      { queue_id: queue_id, state: "waiting" },
      "seq",
      50
    );

    // זיהוי כרטיס יעד
    let targetTicket = null;
    let reason = "";

    if (currentTicket) {
      if (waitingTickets.length >= 2) {
        targetTicket = waitingTickets[1];
        reason = "יש כרטיס בטיפול, היעד הוא הממתין השני";
      } else {
        reason = `לא מספיק ממתינים (צריך 2, יש ${waitingTickets.length})`;
      }
    } else {
      if (waitingTickets.length >= 3) {
        targetTicket = waitingTickets[2];
        reason = "אין כרטיס בטיפול, היעד הוא הממתין השלישי";
      } else {
        reason = `לא מספיק ממתינים (צריך 3, יש ${waitingTickets.length})`;
      }
    }

    // שליפת שם התור
    const queue = await base44.asServiceRole.entities.Queue.get(queue_id);

    const result = {
      queue: {
        id: queue_id,
        name: queue ? queue.name : "לא נמצא"
      },
      currentTicket: currentTicket ? {
        id: currentTicket.id,
        seq: currentTicket.seq,
        state: currentTicket.state
      } : null,
      waitingTickets: waitingTickets.slice(0, 5).map(t => ({
        id: t.id,
        seq: t.seq,
        phone: t.customer_phone || "אין",
        two_before_sms_sent: t.two_before_sms_sent || false
      })),
      waitingCount: waitingTickets.length,
      selectedTarget: targetTicket ? {
        id: targetTicket.id,
        seq: targetTicket.seq,
        phone: targetTicket.customer_phone || "אין",
        alreadySent: targetTicket.two_before_sms_sent || false,
        reason: reason
      } : null,
      reason: reason,
      wouldSendSms: targetTicket && 
                    targetTicket.customer_phone && 
                    !targetTicket.two_before_sms_sent
    };

    console.log("[debugTwoBefore] Result:", JSON.stringify(result, null, 2));

    return Response.json(result, { status: 200 });

  } catch (error) {
    console.error("[debugTwoBefore] Error:", error);
    console.error("[debugTwoBefore] Stack:", error.stack);
    return Response.json({ 
      ok: false, 
      error: String(error),
      stack: error.stack 
    }, { status: 200 });
  }
});