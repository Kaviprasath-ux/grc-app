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

    // "Mark all read" only affects the workspace the user is currently in
    // (plus legacy null-module rows). No module param → mark everything.
    const moduleParam = new URL(req.url).searchParams.get('module');
    const moduleFilter = moduleParam
      ? { OR: [{ module: moduleParam }, { module: null }] }
      : {};

    // Update all unread notifications for this user
    const result = await prisma.notification.updateMany({
      where: {
        ...tenantFilter,
        userId: session.id,
        isRead: false,
        ...moduleFilter,
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
