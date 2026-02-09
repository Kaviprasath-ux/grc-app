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

    const count = await prisma.notification.count({
      where: {
        ...tenantFilter,
        userId: session.id,
        isRead: false,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 }
    );
  }
});
