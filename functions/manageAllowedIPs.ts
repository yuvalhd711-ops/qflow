import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin authentication required
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { action, ip_id, ip_address, description, is_active } = await req.json();

    console.log(`[manageAllowedIPs] Action: ${action}, User: ${user.email}`);

    switch (action) {
      case 'list': {
        const ips = await base44.asServiceRole.entities.AllowedIP.list();
        return Response.json({ success: true, data: ips });
      }

      case 'add': {
        if (!ip_address) {
          return Response.json({ error: 'IP address is required' }, { status: 400 });
        }

        const newIP = await base44.asServiceRole.entities.AllowedIP.create({
          ip_address,
          description: description || '',
          is_active: is_active !== false
        });

        console.log(`[manageAllowedIPs] Added IP: ${ip_address}`);
        return Response.json({ success: true, data: newIP });
      }

      case 'update': {
        if (!ip_id) {
          return Response.json({ error: 'IP ID is required' }, { status: 400 });
        }

        const updateData = {};
        if (ip_address !== undefined) updateData.ip_address = ip_address;
        if (description !== undefined) updateData.description = description;
        if (is_active !== undefined) updateData.is_active = is_active;

        await base44.asServiceRole.entities.AllowedIP.update(ip_id, updateData);
        
        console.log(`[manageAllowedIPs] Updated IP: ${ip_id}`);
        return Response.json({ success: true });
      }

      case 'delete': {
        if (!ip_id) {
          return Response.json({ error: 'IP ID is required' }, { status: 400 });
        }

        await base44.asServiceRole.entities.AllowedIP.delete(ip_id);
        
        console.log(`[manageAllowedIPs] Deleted IP: ${ip_id}`);
        return Response.json({ success: true });
      }

      case 'toggle': {
        if (!ip_id) {
          return Response.json({ error: 'IP ID is required' }, { status: 400 });
        }

        const ip = await base44.asServiceRole.entities.AllowedIP.get(ip_id);
        const currentActive = ip.is_active ?? ip.data?.is_active ?? true;
        
        await base44.asServiceRole.entities.AllowedIP.update(ip_id, {
          is_active: !currentActive
        });
        
        console.log(`[manageAllowedIPs] Toggled IP: ${ip_id} to ${!currentActive}`);
        return Response.json({ success: true, is_active: !currentActive });
      }

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('[manageAllowedIPs] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});