import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { queue_id } = await req.json();
    
    if (!queue_id) {
      return Response.json({ error: 'queue_id is required' }, { status: 400 });
    }

    console.log(`[clearQueue] User ${user.email} clearing queue ${queue_id}`);

    // Get all tickets for this queue
    const allTickets = await base44.entities.Ticket.filter({ queue_id });
    console.log(`[clearQueue] Found ${allTickets.length} tickets to delete`);

    // Delete all tickets
    for (const ticket of allTickets) {
      try {
        await base44.entities.Ticket.delete(ticket.id);
      } catch (error) {
        console.warn(`[clearQueue] Failed to delete ticket ${ticket.id}:`, error);
      }
    }

    // Reset queue counter to 0
    await base44.entities.Queue.update(queue_id, { seq_counter: 0 });
    console.log(`[clearQueue] Queue counter reset to 0`);

    return Response.json({ 
      success: true, 
      deletedCount: allTickets.length,
      message: 'Queue cleared successfully'
    });

  } catch (error) {
    console.error('[clearQueue] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});