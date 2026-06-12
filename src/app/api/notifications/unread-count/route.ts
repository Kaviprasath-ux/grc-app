/**
 * Unread Notification Count API
 *
 * GET /api/notifications/unread-count - Get count of unread notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthOnly, getTenantFilter } from '@/lib/api-auth';

// GET /api/notifications/unread-count - Get unread notification count
export const GET = withAuthOnly(async (req, context, session) => {
  try {
    const tenantFilter = getTenantFilter(session);

    // Check if notification table exists by attempting to count
    // If it doesn't exist, prisma.notification will be undefined
    if (!prisma.notification) {
      return NextResponse.json({ count: 0 });
    }

    // Scope the unread badge to the current workspace (legacy null-module rows
    // always count). No module param → no filter (super-admin / undecided).
    const moduleParam = new URL(req.url).searchParams.get('module');
    const moduleFilter = moduleParam
      ? { OR: [{ module: moduleParam }, { module: null }] }
      : {};

    const count = await prisma.notification.count({
      where: {
        ...tenantFilter,
        userId: session.id,
        isRead: false,
        ...moduleFilter,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    // Silently return 0 if table doesn't exist or any other DB error
    // This prevents breaking the UI when notifications aren't set up yet
    console.warn('Notifications table may not exist yet, returning 0 count');
    return NextResponse.json({ count: 0 });
  }
});
