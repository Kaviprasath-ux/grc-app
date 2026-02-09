/**
 * Mark All Notifications as Read API
 *
 * PATCH /api/notifications/read-all - Mark all user's notifications as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthOnly, getTenantFilter } from '@/lib/api-auth';

// PATCH /api/notifications/read-all - Mark all notifications as read
export const PATCH = withAuthOnly(async (req, context, session) => {
  try {
    const tenantFilter = getTenantFilter(session);

    // Update all unread notifications for this user
    const result = await prisma.notification.updateMany({
      where: {
        ...tenantFilter,
        userId: session.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
});
