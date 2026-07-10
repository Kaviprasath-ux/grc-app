/**
 * SOC self-service password reset (item 14) — server helpers.
 *
 * Security model:
 *  - OTP is 6 digits, stored bcrypt-hashed, single-use, 15-min expiry.
 *  - Max 5 verify attempts per token, then it's locked.
 *  - Rate limited per IP and per user (max 3 active requests / hour).
 *  - >3 requests / hour from one IP raises a security alert (not a ticket).
 *  - Responses are deliberately generic to avoid user enumeration.
 *  - OTPs / passwords are never logged.
 */

import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import {
  notificationService,
  NOTIFICATION_EVENTS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
} from '@/lib/notification-service';

export const OTP_TTL_MINUTES = 15;
export const MAX_VERIFY_ATTEMPTS = 5;
export const MAX_REQUESTS_PER_HOUR = 3;

/** Generate a 6-digit numeric OTP (string, zero-padded). */
export function generateOtp(): string {
  // 100000-999999
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

const hourAgo = () => new Date(Date.now() - 60 * 60 * 1000);

/** How many reset requests this IP made in the last hour. */
export async function recentRequestCountByIp(ip: string): Promise<number> {
  if (!ip) return 0;
  return prisma.passwordResetToken.count({ where: { requestIp: ip, createdAt: { gte: hourAgo() } } });
}

/** How many reset requests this user made in the last hour. */
export async function recentRequestCountByUser(userId: string): Promise<number> {
  return prisma.passwordResetToken.count({ where: { userId, createdAt: { gte: hourAgo() } } });
}

/**
 * Raise an SOC security alert when an IP exceeds the request threshold.
 * Notifies CustomerAdministrators (and GRCAdministrators) of the user's tenant.
 * Best-effort — never throws.
 */
export async function raisePasswordResetAbuseAlert(params: {
  customerAccountId: string | null;
  ip: string;
  userId: string;
  count: number;
}): Promise<void> {
  try {
    if (!params.customerAccountId) return;
    const admins = await prisma.user.findMany({
      where: {
        customerAccountId: params.customerAccountId,
        isActive: true,
        userRoles: { some: { role: { name: { in: ['CustomerAdministrator', 'SupportManager', 'GRCAdministrator'] } } } },
      },
      select: { id: true },
    });
    const recipientIds = admins.map((a) => a.id).filter((id) => id !== params.userId);
    if (recipientIds.length === 0) return;

    await notificationService.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: 'system',
      recipientIds,
      event: NOTIFICATION_EVENTS.SECURITY_PASSWORD_RESET_ABUSE,
      title: 'Security alert: repeated password-reset requests',
      message: `${params.count} password-reset requests from IP ${params.ip} within the last hour.`,
      module: 'GRC',
      priority: NOTIFICATION_PRIORITIES.URGENT,
      channels: [NOTIFICATION_CHANNELS.INBOX],
      metadata: { ip: params.ip, count: params.count },
    });
  } catch (err) {
    console.error('[password-reset] abuse alert failed', err);
  }
}

/** Find a user by username or email (case-insensitive on email). */
export async function findUserForReset(usernameOrEmail: string) {
  const value = usernameOrEmail.trim();
  return prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [{ userName: value }, { email: { equals: value, mode: 'insensitive' } }],
    },
    select: { id: true, email: true, fullName: true, customerAccountId: true },
  });
}
