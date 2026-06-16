import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email-service';
import { getClientIp } from '@/lib/rate-limiter';
import {
  generateOtp,
  hashOtp,
  findUserForReset,
  recentRequestCountByIp,
  recentRequestCountByUser,
  raisePasswordResetAbuseAlert,
  OTP_TTL_MINUTES,
  MAX_REQUESTS_PER_HOUR,
} from '@/lib/support/password-reset';

// Public endpoint — no auth. Always returns a generic success to avoid leaking
// whether an account exists.
const GENERIC = { ok: true, message: 'If an account matches, a one-time code has been sent.' };

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const body = await req.json().catch(() => ({}));
  const usernameOrEmail = (body.usernameOrEmail || '').toString().trim();
  if (!usernameOrEmail) {
    return NextResponse.json({ error: 'Username or email is required' }, { status: 400 });
  }

  // IP-level abuse guard (independent of whether the account exists).
  const ipCount = await recentRequestCountByIp(ip);
  if (ipCount >= MAX_REQUESTS_PER_HOUR) {
    const user = await findUserForReset(usernameOrEmail);
    await raisePasswordResetAbuseAlert({
      customerAccountId: user?.customerAccountId ?? null,
      ip,
      userId: user?.id ?? 'unknown',
      count: ipCount + 1,
    });
    // Still generic — don't reveal throttling specifics.
    return NextResponse.json(GENERIC);
  }

  const user = await findUserForReset(usernameOrEmail);
  if (!user || !user.email) {
    // Record nothing; respond generically.
    return NextResponse.json(GENERIC);
  }

  // Per-user throttle.
  const userCount = await recentRequestCountByUser(user.id);
  if (userCount >= MAX_REQUESTS_PER_HOUR) {
    return NextResponse.json(GENERIC);
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Invalidate prior unconsumed tokens, then issue a fresh one.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, consumed: false },
    data: { consumed: true, consumedAt: new Date() },
  });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, otpHash, expiresAt, requestIp: ip },
  });

  // Deliver OTP by email (best-effort; never log the OTP).
  try {
    await sendEmail({
      to: user.email,
      subject: 'Your password reset code',
      html: `
        <p>Hello ${user.fullName || ''},</p>
        <p>Your one-time password reset code is:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p>
        <p>This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request it, you can ignore this email.</p>
      `,
      text: `Your password reset code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    });
  } catch (err) {
    console.error('[password-reset] email send failed');
    // Still generic to the caller.
  }

  return NextResponse.json(GENERIC);
}
