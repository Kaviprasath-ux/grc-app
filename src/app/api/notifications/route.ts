/**
 * Notifications API
 *
 * GET /api/notifications - Get user's notifications (paginated)
 * POST /api/notifications - Create a notification (internal use)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthOnly, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';

// GET /api/notifications - Get user's notifications
export const GET = withAuthOnly(async (req, context, session) => {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const skip = (page - 1) * limit;

    const tenantFilter = getTenantFilter(session);

    // Build filter conditions
    const whereConditions = {
      ...tenantFilter,
      userId: session.id,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    // Get notifications with pagination
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: whereConditions,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({
        where: whereConditions,
      }),
    ]);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
});

// POST /api/notifications - Create a notification
// This is primarily for internal use by the notification service
export const POST = withAuthOnly(async (req, context, session) => {
  try {
    const body = await req.json();
    const {
      userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      link,
      priority = 'normal',
      metadata,
    } = body;

    // Validate required fields
    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, title, message' },
        { status: 400 }
      );
    }

    // Check if target user exists and belongs to same tenant
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, customerAccountId: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Get customer account ID
    const customerAccountId = targetUser.customerAccountId || getCustomerAccountId(session);

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        customerAccountId,
        userId,
        type,
        title,
        message,
        relatedEntityType,
        relatedEntityId,
        link,
        priority,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
});
