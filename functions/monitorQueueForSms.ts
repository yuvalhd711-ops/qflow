import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log("[monitorQueueForSms] Starting queue monitoring...");
    
    // Get all active queues
    const activeQueues = await base44.asServiceRole.entities.Queue.filter({ is_active: true });
    console.log(`[monitorQueueForSms] Found ${activeQueues.length} active queues`);
    
    let totalSent = 0;
    
    for (const queue of activeQueues) {
      try {
        console.log(`[monitorQueueForSms] Checking queue: ${queue.name} (ID: ${queue.id})`);
        
        // Get waiting tickets sorted by seq
        const waitingTickets = await base44.asServiceRole.entities.Ticket.filter(
          { queue_id: queue.id, state: "waiting" },
          "seq",
          200
        );
        
        // Get current ticket in service
        const inServiceTickets = await base44.asServiceRole.entities.Ticket.filter({
          queue_id: queue.id,
          state: { "$in": ["called", "in_service"] }
        });
        
        const currentTicket = inServiceTickets.length > 0 ? inServiceTickets[0] : null;
        
        console.log(`[monitorQueueForSms] Queue ${queue.name}: ${waitingTickets.length} waiting, current ticket: ${currentTicket ? currentTicket.seq : 'none'}`);
        
        // Determine target ticket (2 places before being called)
        let targetTicket = null;
        
        if (currentTicket && waitingTickets.length >= 2) {
          // If there's a ticket in service, target is the 2nd waiting ticket
          targetTicket = waitingTickets[1];
        } else if (!currentTicket && waitingTickets.length >= 3) {
          // If no ticket in service, target is the 3rd waiting ticket
          targetTicket = waitingTickets[2];
        }
        
        // Check if we should send SMS
        if (targetTicket && 
            targetTicket.customer_phone && 
            !targetTicket.two_before_sms_sent) {
          
          console.log(`[monitorQueueForSms] Sending reminder SMS to ticket ${targetTicket.seq} in queue ${queue.name}`);
          
          // Send SMS
          try {
            await base44.asServiceRole.functions.invoke('sendSms', {
              phoneNumber: targetTicket.customer_phone,
              queueName: queue.name,
              ticketSeq: targetTicket.seq,
              messageType: 'reminder'
            });
            
            // Mark as sent
            await base44.asServiceRole.entities.Ticket.update(targetTicket.id, {
              two_before_sms_sent: true
            });
            
            console.log(`[monitorQueueForSms] ✓ Reminder SMS sent to ticket ${targetTicket.seq}`);
            totalSent++;
            
          } catch (smsError) {
            console.error(`[monitorQueueForSms] Error sending SMS to ticket ${targetTicket.seq}:`, smsError);
          }
        } else if (targetTicket) {
          console.log(`[monitorQueueForSms] Ticket ${targetTicket.seq} - phone: ${!!targetTicket.customer_phone}, sent: ${targetTicket.two_before_sms_sent}`);
        }
        
      } catch (queueError) {
        console.error(`[monitorQueueForSms] Error processing queue ${queue.id}:`, queueError);
      }
    }
    
    console.log(`[monitorQueueForSms] Monitoring complete. Sent ${totalSent} reminder SMS`);
    
    return Response.json({
      ok: true,
      queuesChecked: activeQueues.length,
      remindersSent: totalSent
    });
    
  } catch (error) {
    console.error("[monitorQueueForSms] Fatal error:", error);
    return Response.json({
      ok: false,
      error: String(error)
    }, { status: 500 });
  }
});