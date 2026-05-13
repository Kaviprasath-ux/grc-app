import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { notificationService } from '@/lib/notification-service';
import { translateRecord } from '@/lib/translation-service';
import { checkUserLimit, checkFactoryUserLimit } from '@/lib/tprm-subscription';
import { assertUserGloballyUnique } from '@/lib/user-uniqueness';
import { isValidEmailFormat } from '@/lib/validations/email';

// TPRM-specific roles that can be assigned by the customer admin (CustomerAdministrator)
const TPRM_USER_ROLES = [
  'Approver',
  'Assessor',
  'Auditor',
  'BusinessOwner',
  'InternalITTeam',
  'RelationshipManager',
] as const;

// GET /api/tprm/user-management — List users in the admin's tenant
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const search = searchParams.get('search') || '';
      const role = searchParams.get('role') || '';
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '50');
      const skip = (page - 1) * limit;

      // Build where clause — only show users with a tprmRole set (TPRM users)
      const where: Record<string, unknown> = {
        customerAccountId,
        tprmRole: { not: null },
        // Exclude the admin themselves
        NOT: {
          id: session.id,
        },
      };

      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { userName: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Role filter: filter by tprmRole field
      if (role && role !== 'all') {
        where.tprmRole = role;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
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
            departmentId: true,
            department: { select: { id: true, name: true } },
            customerAccount: {
              select: { name: true },
            },
            createdAt: true,
          },
          orderBy: { fullName: 'asc' },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      return NextResponse.json({
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('User Management GET error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }
  },
  { resource: ['tprm.user-management', 'tprm.bo-user-management', 'tprm.factory-user-management'], action: 'view' }
);

// POST /api/tprm/user-management — Create a new TPRM user
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { firstName: bodyFirstName, lastName: bodyLastName, fullName, email, userName, password, tprmRole, tprmFunctionCategory, departmentName, isActive } = body;

      if (!fullName || !email || !userName || !password || !tprmRole) {
        return NextResponse.json(
          { error: 'Full name, email, username, password, and role are required' },
          { status: 400 }
        );
      }

      if (!isValidEmailFormat(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }

      // Account Manager users cannot be created from User Management
      if (tprmRole === 'Account Manager') {
        return NextResponse.json(
          { error: 'Account Manager users cannot be created from User Management' },
          { status: 403 }
        );
      }

      // Business Owner and Relationship Manager must be tagged to a Department
      // so vendor inventory can show the correct owning department.
      // The UI picks from the TPRM Configurations department list and sends
      // the name; we resolve (or create) a matching Department row so the
      // User.departmentId FK stays valid without duplicating entity state.
      const DEPT_REQUIRED = new Set(['Business Owner', 'Relationship Manager']);
      const resolvedDepartmentId = await resolveDepartmentId(
        customerAccountId,
        tprmRole,
        departmentName,
        DEPT_REQUIRED
      );
      if (DEPT_REQUIRED.has(tprmRole) && !resolvedDepartmentId) {
        return NextResponse.json(
          { error: 'Department is required for Business Owner and Relationship Manager' },
          { status: 400 }
        );
      }

      // Check subscription plan user limit
      const userCheck = tprmRole === 'Factory Assessor'
        ? await checkFactoryUserLimit(customerAccountId)
        : await checkUserLimit(customerAccountId);
      if (!userCheck.allowed) {
        return NextResponse.json({ error: userCheck.message }, { status: 403 });
      }

      // Phase 10 — global uniqueness across all customers.
      const unique = await assertUserGloballyUnique({ userName, email });
      if (!unique.ok) {
        return NextResponse.json(
          { error: unique.message, field: unique.field },
          { status: 409 },
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Generate a unique userId
      const userCount = await prisma.user.count({ where: { customerAccountId } });
      const userId = `TPRM_${customerAccountId.substring(0, 6)}_${String(userCount + 1).padStart(3, '0')}`;

      // Use firstName/lastName from body if provided, otherwise split fullName
      const firstName = bodyFirstName || fullName.trim().split(/\s+/)[0] || fullName;
      const lastName = bodyLastName || fullName.trim().split(/\s+/).slice(1).join(' ') || '-';

      // Create user with TPRM-specific fields
      const user = await prisma.user.create({
        data: {
          userId,
          customerAccountId,
          fullName,
          firstName,
          lastName,
          email,
          userName,
          password: hashedPassword,
          tprmRole: tprmRole,
          tprmFunctionCategory: tprmFunctionCategory || 'TPRM Team',
          departmentId: resolvedDepartmentId,
          isActive: isActive !== false,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          userName: true,
          isActive: true,
          tprmRole: true,
          tprmFunctionCategory: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          createdAt: true,
        },
      });

      // Trigger dynamic translation for user-entered name fields
      void translateRecord(customerAccountId, 'User', user.id, {
        fullName: user.fullName,
        firstName,
        lastName,
      });

      // Auto-assign UserRole based on tprmRole
      const tprmRoleToSystemRole: Record<string, string> = {
        'Business Owner': 'BusinessOwner',
        'Relationship Manager': 'RelationshipManager',
        'Assessor': 'TPRMAssessor',
        'Approver': 'TPRMApprover',
        'Auditor': 'TPRMAuditor',
        'Account Manager': 'AccountManager',
        'Factory Assessor': 'FactoryAssessor',
        'Internal IT Team': 'InternalITTeam',
      };
      const systemRoleName = tprmRoleToSystemRole[tprmRole];
      if (systemRoleName) {
        // Ensure the Role record exists (upsert so it works even without reseeding)
        const systemRole = await prisma.role.upsert({
          where: { name: systemRoleName },
          update: {},
          create: { name: systemRoleName, description: `TPRM ${tprmRole} role`, isSystem: true },
        });
        await prisma.userRole.create({
          data: { userId: user.id, roleId: systemRole.id },
        });
      }

      // Send in-app notification to new user
      void notificationService.notifyTPRMAccountCreated({
        customerAccountId,
        actorId: session.id,
        newUserId: user.id,
        userName: user.fullName,
        tprmRole,
      });

      // When BO creates an RM account, notify other admins/BOs
      if (tprmRole === 'Relationship Manager') {
        const adminsAndBOs = await prisma.user.findMany({
          where: {
            customerAccountId,
            isActive: true,
            id: { notIn: [session.id, user.id] },
            OR: [
              { role: { in: ['GRCAdministrator', 'CustomerAdministrator'] } },
              { tprmRole: 'Business Owner' },
            ],
          },
          select: { id: true },
          take: 10,
        });
        if (adminsAndBOs.length > 0) {
          void notificationService.notifyTPRMRMAccountCreated({
            customerAccountId,
            actorId: session.id,
            recipientIds: adminsAndBOs.map(a => a.id),
            rmName: user.fullName,
            rmEmail: user.email,
          });
        }
      }

      return NextResponse.json(user, { status: 201 });
    } catch (error) {
      console.error('User Management POST error:', error);
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }
  },
  { resource: ['tprm.user-management', 'tprm.bo-user-management', 'tprm.factory-user-management'], action: 'create' }
);

// PATCH /api/tprm/user-management — Update a TPRM user
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id, firstName, lastName, fullName, email, password, tprmRole, tprmFunctionCategory, departmentName, isActive } = body;

      if (!id) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }

      // Verify user belongs to same tenant
      const existingUser = await prisma.user.findFirst({
        where: { id, customerAccountId },
      });

      if (!existingUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (email && !isValidEmailFormat(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }

      // Phase 10 — global email uniqueness on edit (excluding current row).
      if (email && email !== existingUser.email) {
        const unique = await assertUserGloballyUnique({ email, excludeUserId: id });
        if (!unique.ok) {
          return NextResponse.json(
            { error: unique.message, field: unique.field },
            { status: 409 },
          );
        }
      }

      const updateData: Record<string, unknown> = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (tprmRole !== undefined) updateData.tprmRole = tprmRole;
      if (tprmFunctionCategory !== undefined) updateData.tprmFunctionCategory = tprmFunctionCategory;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      // Department handling for Business Owner / Relationship Manager.
      // Same name-based resolution used on POST: find-or-create a Department
      // row matching the picked name, then store its id on User.departmentId.
      const DEPT_REQUIRED_EDIT = new Set(['Business Owner', 'Relationship Manager']);
      const effectiveRole = (tprmRole !== undefined ? tprmRole : existingUser.tprmRole) as string | null;
      if (effectiveRole && DEPT_REQUIRED_EDIT.has(effectiveRole)) {
        const resolvedId = await resolveDepartmentId(
          customerAccountId,
          effectiveRole,
          departmentName,
          DEPT_REQUIRED_EDIT
        );
        if (!resolvedId) {
          return NextResponse.json(
            { error: 'Department is required for Business Owner and Relationship Manager' },
            { status: 400 }
          );
        }
        updateData.departmentId = resolvedId;
      } else if (departmentName !== undefined) {
        // Role not BO/RM: clear any stale department reference
        updateData.departmentId = null;
      }

      const updatedUser = await prisma.user.update({
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
          departmentId: true,
          department: { select: { id: true, name: true } },
          createdAt: true,
        },
      });

      // Trigger dynamic translation for updated name fields
      const translationFields: Record<string, string> = {};
      if (updatedUser.fullName) translationFields.fullName = updatedUser.fullName;
      if (firstName) translationFields.firstName = firstName;
      if (lastName) translationFields.lastName = lastName;
      if (Object.keys(translationFields).length > 0) {
        void translateRecord(customerAccountId, 'User', updatedUser.id, translationFields);
      }

      // Update UserRole if tprmRole changed
      if (tprmRole !== undefined && tprmRole !== existingUser.tprmRole) {
        const tprmRoleToSystemRole: Record<string, string> = {
          'Business Owner': 'BusinessOwner',
          'Relationship Manager': 'RelationshipManager',
          'Assessor': 'TPRMAssessor',
          'Approver': 'TPRMApprover',
          'Auditor': 'TPRMAuditor',
          'Factory Assessor': 'FactoryAssessor',
          'Internal IT Team': 'InternalITTeam',
        };

        // Remove old TPRM-related system roles
        const oldSystemRoleName = existingUser.tprmRole ? tprmRoleToSystemRole[existingUser.tprmRole] : null;
        if (oldSystemRoleName) {
          const oldRole = await prisma.role.findFirst({ where: { name: oldSystemRoleName } });
          if (oldRole) {
            await prisma.userRole.deleteMany({ where: { userId: id, roleId: oldRole.id } });
          }
        }

        // Assign new system role (upsert Role to ensure it exists)
        const newSystemRoleName = tprmRoleToSystemRole[tprmRole];
        if (newSystemRoleName) {
          const newRole = await prisma.role.upsert({
            where: { name: newSystemRoleName },
            update: {},
            create: { name: newSystemRoleName, description: `TPRM ${tprmRole} role`, isSystem: true },
          });
          await prisma.userRole.upsert({
            where: { userId_roleId_moduleCode: { userId: id, roleId: newRole.id, moduleCode: "TPRM" } },
            create: { userId: id, roleId: newRole.id, moduleCode: "TPRM" },
            update: {},
          });
        }
      }

      return NextResponse.json(updatedUser);
    } catch (error) {
      console.error('User Management PATCH error:', error);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }
  },
  { resource: ['tprm.user-management', 'tprm.bo-user-management', 'tprm.factory-user-management'], action: 'edit' }
);

// DELETE /api/tprm/user-management — Delete a TPRM user
export const DELETE = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }

      // Verify user belongs to same tenant
      const user = await prisma.user.findFirst({
        where: { id, customerAccountId },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Don't allow deleting yourself
      if (id === session.id) {
        return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
      }

      // Account Manager users cannot be deleted
      if (user.tprmRole === 'Account Manager') {
        return NextResponse.json({ error: 'Account Manager users cannot be deleted' }, { status: 403 });
      }

      await prisma.user.delete({ where: { id } });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('User Management DELETE error:', error);
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      );
    }
  },
  { resource: ['tprm.user-management', 'tprm.bo-user-management', 'tprm.factory-user-management'], action: 'delete' }
);

/**
 * Resolve a department NAME (as picked in the UI) to the id of a row in the
 * Department table. Find-or-create so that the User.departmentId FK is always
 * valid — even when the list the UI shows comes from TPRMDepartment.
 *
 * Returns null when the role doesn't require a department or when no name
 * was provided.
 */
async function resolveDepartmentId(
  customerAccountId: string,
  role: string | null | undefined,
  name: unknown,
  deptRequired: Set<string>
): Promise<string | null> {
  if (!role || !deptRequired.has(role)) return null;
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await prisma.department.findFirst({
    where: {
      customerAccountId,
      name: { equals: trimmed, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.department.create({
    data: { customerAccountId, name: trimmed },
    select: { id: true },
  });
  return created.id;
}
