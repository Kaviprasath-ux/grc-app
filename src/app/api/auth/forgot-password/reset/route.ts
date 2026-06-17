import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import {
  findUserForReset,
  verifyOtpHash,
  MAX_VERIFY_ATTEMPTS,
} from '@/lib/support/password-reset';

// Public endpoint — verifies the OTP and sets a new password in one step.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const usernameOrEmail = (body.usernameOrEmail || '').toString().trim();
  const otp = (body.otp || '').toString().trim();
  const newPassword = (body.newPassword || '').toString();

  if (!usernameOrEmail || !otp || !newPassword) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const user = await findUserForReset(usernameOrEmail);
  if (!user) {
    return NextResponse.json({ error: 'Invalid code or it has expired' }, { status: 400 });
  }

  const token = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, consumed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!token || token.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid code or it has expired' }, { status: 400 });
  }
  if (token.attempts >= MAX_VERIFY_ATTEMPTS) {
    // Lock this token to stop brute force.
    await prisma.passwordResetToken.update({ where: { id: token.id }, data: { consumed: true, consumedAt: new Date() } });
    return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 429 });
  }

  const valid = await verifyOtpHash(otp, token.otpHash);
  if (!valid) {
    await prisma.passwordResetToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: 'Invalid code or it has expired' }, { status: 400 });
  }

  // Success — set the new password and consume the token.
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { consumed: true, consumedAt: new Date() } }),
    // Invalidate any other outstanding tokens for this user.
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumed: false },
      data: { consumed: true, consumedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true, message: 'Password updated. You can now sign in.' });
}
