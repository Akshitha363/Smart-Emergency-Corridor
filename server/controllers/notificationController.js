import prisma from '../config/prisma.js';

export async function getNotifications(req, res) {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const hospitalId = req.user?.hospitalId;
    const ambulanceId = req.user?.ambulanceId;

    const conditions = [];

    if (userId) {
      conditions.push({ userId });
      conditions.push({ recipient: `user:${userId}` });
    }

    if (userRole) {
      if (userRole === 'HOSPITAL') {
        // Hospital ONLY sees hospital-specific and role:HOSPITAL notifications
        conditions.push({ recipient: 'role:HOSPITAL', role: 'HOSPITAL' });
        if (hospitalId) {
          conditions.push({ recipient: `hospital:${hospitalId}` });
        }
      } else if (userRole === 'AMBULANCE') {
        // Ambulance sees Ambulance, Traffic Police, and Service Provider notifications
        conditions.push({ recipient: 'role:AMBULANCE', role: 'AMBULANCE' });
        conditions.push({ recipient: 'role:TRAFFIC', role: 'TRAFFIC' });
        conditions.push({ recipient: 'role:SERVICE_PROVIDER', role: 'SERVICE_PROVIDER' });
        if (ambulanceId) {
          conditions.push({ recipient: `ambulance:${ambulanceId}` });
        }
      } else if (userRole === 'TRAFFIC') {
        // Traffic Police sees Traffic Police and Service Provider notifications
        conditions.push({ recipient: 'role:TRAFFIC', role: 'TRAFFIC' });
        conditions.push({ recipient: 'role:SERVICE_PROVIDER', role: 'SERVICE_PROVIDER' });
      } else if (userRole === 'SERVICE_PROVIDER') {
        // Service Provider sees Service Provider and Traffic Police notifications
        conditions.push({ recipient: 'role:SERVICE_PROVIDER', role: 'SERVICE_PROVIDER' });
        conditions.push({ recipient: 'role:TRAFFIC', role: 'TRAFFIC' });
      } else if (userRole === 'ADMIN') {
        conditions.push({ role: 'ADMIN' });
        conditions.push({ recipient: 'role:ADMIN' });
        conditions.push({ recipient: 'SYSTEM' });
      }
    }

    const whereClause = conditions.length > 0 ? { OR: conditions } : { id: 'impossible-id' };

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        read: false,
        ...whereClause,
      },
    });

    return res.json({
      notifications: notifications.map(n => ({
        ...n,
        metadata: n.metadata ? (typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata) : null,
      })),
      unreadCount,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return res.json({ notification: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function markAllNotificationsAsRead(req, res) {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const hospitalId = req.user?.hospitalId;
    const ambulanceId = req.user?.ambulanceId;

    const conditions = [];

    if (userId) {
      conditions.push({ userId });
      conditions.push({ recipient: `user:${userId}` });
    }

    if (userRole) {
      if (userRole === 'HOSPITAL') {
        conditions.push({ recipient: 'role:HOSPITAL', role: 'HOSPITAL' });
        if (hospitalId) {
          conditions.push({ recipient: `hospital:${hospitalId}` });
        }
      } else if (userRole === 'AMBULANCE') {
        conditions.push({ recipient: 'role:AMBULANCE', role: 'AMBULANCE' });
        conditions.push({ recipient: 'role:TRAFFIC', role: 'TRAFFIC' });
        conditions.push({ recipient: 'role:SERVICE_PROVIDER', role: 'SERVICE_PROVIDER' });
        if (ambulanceId) {
          conditions.push({ recipient: `ambulance:${ambulanceId}` });
        }
      } else if (userRole === 'TRAFFIC') {
        conditions.push({ recipient: 'role:TRAFFIC', role: 'TRAFFIC' });
        conditions.push({ recipient: 'role:SERVICE_PROVIDER', role: 'SERVICE_PROVIDER' });
      } else if (userRole === 'SERVICE_PROVIDER') {
        conditions.push({ recipient: 'role:SERVICE_PROVIDER', role: 'SERVICE_PROVIDER' });
        conditions.push({ recipient: 'role:TRAFFIC', role: 'TRAFFIC' });
      } else if (userRole === 'ADMIN') {
        conditions.push({ role: 'ADMIN' });
        conditions.push({ recipient: 'role:ADMIN' });
      }
    }

    const whereClause = conditions.length > 0 ? { OR: conditions } : { id: 'impossible-id' };

    await prisma.notification.updateMany({
      where: {
        read: false,
        ...whereClause,
      },
      data: { read: true },
    });

    return res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
