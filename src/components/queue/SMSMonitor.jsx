import { useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const SMS_THRESHOLD_MINUTES = 15;

export default function SMSMonitor({ branchId }) {
  const checkWaitTimes = useCallback(async () => {
    if (!branchId) return;

    try {
      const queues = await base44.entities.Queue.filter({ branch_id: parseInt(branchId), is_active: true });
      const queueIds = queues.map(q => q.id);

      if (queueIds.length === 0) return;

      const now = new Date();
      const thresholdTime = new Date(now.getTime() - SMS_THRESHOLD_MINUTES * 60000);

      const allTickets = await base44.entities.Ticket.list();
      const waitingTickets = allTickets.filter(t => 
        queueIds.includes(t.queue_id) && 
        t.state === "waiting" &&
        new Date(t.created_date) < thresholdTime
      );

      if (waitingTickets.length > 0) {
        const contacts = await base44.entities.BranchContact.filter({ branch_id: parseInt(branchId), is_active: true });
        
        for (const contact of contacts) {
          const message = `התראה: יש ${waitingTickets.length} לקוחות ממתינים מעל ${SMS_THRESHOLD_MINUTES} דקות בסניף ${branchId}`;
          
          try {
            await base44.integrations.Core.SendEmail({
              to: contact.phone_number + "@sms-gateway.com",
              subject: "התראת זמן המתנה",
              body: message
            });
          } catch (error) {
            console.error("Failed to send SMS alert:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error checking wait times:", error);
    }
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;

    checkWaitTimes();
    const interval = setInterval(checkWaitTimes, 180000);

    return () => clearInterval(interval);
  }, [branchId, checkWaitTimes]);

  return null;
}