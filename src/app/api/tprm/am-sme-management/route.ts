import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET /api/tprm/am-sme-management — List SMEs created by this AM
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const search = searchParams.get('search') || '';

      const where: Record<string, unknown> = {
        customerAccountId,
        tprmRole: 'SME',
        createdById: session.id,
      };

      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { userName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const smes = await prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          email: true,
          userName: true,
          isActive: true,
          tprmRole: true,
          tprmFunctionCategory: true,
          customerAccount: { select: { name: true } },
          createdAt: true,
        },
        orderBy: { fullName: 'asc' },
      });

      return NextResponse.json({ data: smes });
    } catch (error) {
      console.error('AM SME GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch SMEs' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-sme-management', action: 'view' }
);

// POST /api/tprm/am-sme-management — Create a new SME
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { firstName, lastName, fullName, email, userName, password, tprmFunctionCategory, isActive } = body;

      if (!fullName || !email || !userName || !password) {
        return NextResponse.json(
          { error: 'Full name, email, username, and password are required' },
          { status: 400 }
        );
      }

      // Check for duplicates
      const existing = await prisma.user.findFirst({
        where: {
          customerAccountId,
          OR: [
            { userName: { equals: userName, mode: 'insensitive' } },
            { email: { equals: email, mode: 'insensitive' } },
          ],
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'A user with this username or email already exists' },
          { status: 409 }
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userCount = await prisma.user.count({ where: { customerAccountId } });
      const userId = `SME_${customerAccountId.substring(0, 6)}_${String(userCount + 1).padStart(3, '0')}`;

      const fName = firstName || fullName.trim().split(/\s+/)[0] || fullName;
      const lName = lastName || fullName.trim().split(/\s+/).slice(1).join(' ') || '-';

      const sme = await prisma.user.create({
        data: {
          userId,
          customerAccountId,
          fullName,
          firstName: fName,
          lastName: lName,
          email,
          userName,
          password: hashedPassword,
          tprmRole: 'SME',
          tprmFunctionCategory: tprmFunctionCategory || 'Vendor SME',
          isActive: isActive !== false,
          createdById: session.id,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          userName: true,
          isActive: true,
          tprmRole: true,
          tprmFunctionCategory: true,
          createdAt: true,
        },
      });

      return NextResponse.json(sme, { status: 201 });
    } catch (error) {
      console.error('AM SME POST error:', error);
      return NextResponse.json({ error: 'Failed to create SME' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-sme-management', action: 'create' }
);

// PATCH /api/tprm/am-sme-management — Update an SME
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id, firstName, lastName, fullName, email, password, tprmFunctionCategory, isActive } = body;

      if (!id) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }

      // Verify SME belongs to this AM
      const existing = await prisma.user.findFirst({
        where: { id, customerAccountId, tprmRole: 'SME', createdById: session.id },
      });

      if (!existing) {
        return NextResponse.json({ error: 'SME not found' }, { status: 404 });
      }

      // Check duplicate email
      if (email && email !== existing.email) {
        const emailExists = await prisma.user.findFirst({
          where: {
            customerAccountId,
            email: { equals: email, mode: 'insensitive' },
            NOT: { id },
          },
        });
        if (emailExists) {
          return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (tprmFunctionCategory !== undefined) updateData.tprmFunctionCategory = tprmFunctionCategory;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          fullName: true,
          email: true,
          userName: true,
          isActive: true,
          tprmRole: true,
          tprmFunctionCategory: true,
          createdAt: true,
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error('AM SME PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update SME' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-sme-management', action: 'edit' }
);

// DELETE /api/tprm/am-sme-management — Delete an SME
export const DELETE = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }

      const sme = await prisma.user.findFirst({
        where: { id, customerAccountId, tprmRole: 'SME', createdById: session.id },
      });

      if (!sme) {
        return NextResponse.json({ error: 'SME not found' }, { status: 404 });
      }

      await prisma.user.delete({ where: { id } });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('AM SME DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete SME' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-sme-management', action: 'delete' }
);
