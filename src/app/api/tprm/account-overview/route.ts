import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import bcrypt from "bcryptjs";
import { translateRecord } from "@/lib/translation-service";
import { ensureComplimentarySubscription, type ModuleCode } from "@/lib/customer-complimentary";

// Helper: generate the next available customer account code
async function generateNextAccountCode(): Promise<string> {
  const allAccounts = await prisma.customerAccount.findMany({
    select: { code: true },
  });
  const existingCodes = new Set(allAccounts.map((a) => a.code));

  let maxNum = 0;
  for (const account of allAccounts) {
    const num = parseInt(account.code.replace("GRC_", "")) || 0;
    if (num > maxNum) maxNum = num;
  }

  let nextNum = maxNum + 1;
  let nextCode = `GRC_${String(nextNum).padStart(3, "0")}`;
  while (existingCodes.has(nextCode)) {
    nextNum++;
    nextCode = `GRC_${String(nextNum).padStart(3, "0")}`;
  }
  return nextCode;
}

// ==================== GET — Account overview data by tab ====================
export const GET = withAuth(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const tab = searchParams.get("tab") || "customers";
      const search = searchParams.get("search") || "";
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      switch (tab) {
        case "customers": {
          // Only show accounts with isTprmAdded = true
          let tprmAccountIds: string[] = [];
          try {
            const tprmAccounts = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
              `SELECT id FROM "CustomerAccount" WHERE "isTprmAdded" = true`
            );
            tprmAccountIds = tprmAccounts.map((a) => a.id);
          } catch {
            // If column doesn't exist yet, show nothing
          }

          if (tprmAccountIds.length === 0) {
            return NextResponse.json({ data: [], pagination: { total: 0, limit, offset, hasMore: false } });
          }

          const where: Record<string, unknown> = {
            id: { in: tprmAccountIds },
            users: {
              some: {
                userRoles: {
                  some: { role: { name: { in: ["CustomerAdministrator", "TPRMCustomerAdmin"] } } },
                },
              },
            },
          };
          if (search) {
            where.AND = [
              {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { code: { contains: search, mode: "insensitive" } },
                ],
              },
            ];
          }

          const [accounts, total] = await Promise.all([
            prisma.customerAccount.findMany({
              where,
              include: {
                users: {
                  where: {
                    userRoles: {
                      some: { role: { name: { in: ["CustomerAdministrator", "TPRMCustomerAdmin"] } } },
                    },
                  },
                  select: { id: true, fullName: true, email: true },
                  take: 1,
                },
                _count: {
                  select: { tprmAssessments: true, tprmVendors: true },
                },
              },
              orderBy: { name: "asc" },
              take: limit,
              skip: offset,
            }),
            prisma.customerAccount.count({ where }),
          ]);

          // Get onboarded vendor counts per account
          const onboardedCounts = await prisma.tPRMVendor.groupBy({
            by: ["customerAccountId"],
            where: { status: "Onboarded" },
            _count: { id: true },
          });
          const onboardedMap = new Map(onboardedCounts.map((c) => [c.customerAccountId, c._count.id]));

          // Fetch isGrcAdded/isTprmAdded via raw query (Prisma client may not have these fields yet)
          const accountIds = accounts.map((a) => a.id);
          let flagsMap = new Map<string, { isGrcAdded: boolean; isTprmAdded: boolean }>();
          if (accountIds.length > 0) {
            try {
              const flags = await prisma.$queryRawUnsafe<
                Array<{ id: string; isGrcAdded: boolean; isTprmAdded: boolean }>
              >(
                `SELECT id, "isGrcAdded", "isTprmAdded" FROM "CustomerAccount" WHERE id IN (${accountIds.map((_, i) => `$${i + 1}`).join(",")})`,
                ...accountIds
              );
              flagsMap = new Map(flags.map((f) => [f.id, { isGrcAdded: f.isGrcAdded, isTprmAdded: f.isTprmAdded }]));
            } catch {
              // If columns don't exist yet, default to false
            }
          }

          const data = accounts.map((a) => {
            const flags = flagsMap.get(a.id);
            return {
              id: a.id,
              userId: a.users[0]?.id || null,
              companyName: a.name,
              fullName: a.users[0]?.fullName || "-",
              email: a.users[0]?.email || "-",
              active: a.isActive ? "Yes" : "No",
              assessmentCount: a._count.tprmAssessments,
              onboardedVendor: onboardedMap.get(a.id) || 0,
              isGrcAdded: flags?.isGrcAdded ?? false,
              isTprmAdded: flags?.isTprmAdded ?? false,
            };
          });

          return NextResponse.json({ data, pagination: { total, limit, offset, hasMore: offset + data.length < total } });
        }

        case "vendors": {
          const where: Record<string, unknown> = {};
          if (search) {
            where.OR = [
              { name: { contains: search, mode: "insensitive" } },
              { vendorCode: { contains: search, mode: "insensitive" } },
            ];
          }

          const [vendors, total] = await Promise.all([
            prisma.tPRMVendor.findMany({
              where,
              select: {
                id: true,
                vendorCode: true,
                name: true,
                customerAccountId: true,
                customerAccount: { select: { name: true } },
              },
              orderBy: { vendorCode: "asc" },
              take: limit,
              skip: offset,
            }),
            prisma.tPRMVendor.count({ where }),
          ]);

          const data = vendors.map((v, idx) => ({
            id: v.id,
            label: `${offset + idx + 1}-${v.name}`,
            name: v.name,
            vendorCode: v.vendorCode,
            customerAccountName: v.customerAccount.name,
          }));

          return NextResponse.json({ data, pagination: { total, limit, offset, hasMore: offset + data.length < total } });
        }

        case "vendor-users": {
          const vendorId = searchParams.get("vendorId");
          if (!vendorId) {
            return NextResponse.json({ error: "vendorId required" }, { status: 400 });
          }

          const vendor = await prisma.tPRMVendor.findUnique({
            where: { id: vendorId },
            select: { customerAccountId: true, name: true, accountManagerEmail: true },
          });
          if (!vendor) {
            return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
          }

          // "Vendor Accounts" must be scoped to *this* vendor's
          // Account Manager(s) and any SMEs they spawned — NOT every
          // user in the outsourcer's tenant. Previously the query
          // returned all tenant users, which lumped the customer's own
          // BO/RM/Assessor accounts into the vendor's panel.
          //
          // AM linkage: TPRMVendor.accountManagerEmail is a semicolon-
          // separated list. We resolve each to its User row by email
          // within the same tenant.
          // SME linkage: each SME User has createdById pointing at the
          // AM that created them, so we fan out from the AM ids.
          // Split on any common separator + whitespace. Users
           // sometimes paste emails space- or newline-separated, and
           // the prior /[;,]/ split would treat "a@x b@x" as a single
           // string and resolve only the first AM.
          const amEmails = (vendor.accountManagerEmail || "")
            .split(/[;,\s\n]+/)
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);

          let allowedUserIds: string[] = [];
          if (amEmails.length > 0) {
            const ams = await prisma.user.findMany({
              where: {
                customerAccountId: vendor.customerAccountId,
                email: { in: amEmails, mode: "insensitive" },
              },
              select: { id: true },
            });
            const amIds = ams.map((u) => u.id);
            const smes = amIds.length
              ? await prisma.user.findMany({
                  where: {
                    customerAccountId: vendor.customerAccountId,
                    createdById: { in: amIds },
                    tprmRole: "SME",
                  },
                  select: { id: true },
                })
              : [];
            allowedUserIds = [...amIds, ...smes.map((u) => u.id)];
          }

          if (allowedUserIds.length === 0) {
            return NextResponse.json({ data: [], pagination: { total: 0, limit, offset, hasMore: false } });
          }

          const userWhere: Record<string, unknown> = {
            id: { in: allowedUserIds },
          };
          if (search) {
            userWhere.OR = [
              { fullName: { contains: search, mode: "insensitive" } },
              { userName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ];
          }

          const [users, userTotal] = await Promise.all([
            prisma.user.findMany({
              where: userWhere,
              select: {
                id: true,
                fullName: true,
                userName: true,
                email: true,
                isActive: true,
                createdAt: true,
                lastLogin: true,
                customerAccount: { select: { name: true } },
              },
              orderBy: { createdAt: "desc" },
              take: limit,
              skip: offset,
            }),
            prisma.user.count({ where: userWhere }),
          ]);

          const data = users.map((u) => ({
            id: u.id,
            // Show the *vendor* name, not the outsourcer tenant — these
            // users are conceptually employees of the vendor, even
            // though they live in the customer's tenant for auth.
            companyName: vendor.name || "-",
            fullName: u.fullName,
            username: u.userName,
            email: u.email,
            createdDate: u.createdAt,
            lastLogin: u.lastLogin,
            active: u.isActive ? "Yes" : "No",
          }));

          return NextResponse.json({ data, pagination: { total: userTotal, limit, offset, hasMore: offset + data.length < userTotal } });
        }

        case "factory": {
          // Only show accounts with isTprmAdded = true
          let factoryTprmIds: string[] = [];
          try {
            const tprmAccts = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
              `SELECT id FROM "CustomerAccount" WHERE "isTprmAdded" = true`
            );
            factoryTprmIds = tprmAccts.map((a) => a.id);
          } catch {
            // If column doesn't exist yet, show nothing
          }

          if (factoryTprmIds.length === 0) {
            return NextResponse.json({ data: [], pagination: { total: 0, limit, offset, hasMore: false } });
          }

          const where: Record<string, unknown> = {
            id: { in: factoryTprmIds },
            users: {
              some: {
                userRoles: {
                  some: { role: { name: "FactoryAdmin" } },
                },
              },
            },
          };
          if (search) {
            where.AND = [
              {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                ],
              },
            ];
          }

          const [accounts, total] = await Promise.all([
            prisma.customerAccount.findMany({
              where,
              include: {
                users: {
                  where: {
                    userRoles: {
                      some: { role: { name: "FactoryAdmin" } },
                    },
                  },
                  select: { id: true, fullName: true, email: true },
                  take: 1,
                },
              },
              orderBy: { name: "asc" },
              take: limit,
              skip: offset,
            }),
            prisma.customerAccount.count({ where }),
          ]);

          // Get factory assessment counts per account
          const factoryCounts = await prisma.tPRMAssessment.groupBy({
            by: ["customerAccountId"],
            where: { assessmentType: "Assessment Factory" },
            _count: { id: true },
          });
          const factoryMap = new Map(factoryCounts.map((c) => [c.customerAccountId, c._count.id]));

          const data = accounts.map((a) => ({
            id: a.id,
            userId: a.users[0]?.id || null,
            companyName: a.name,
            fullName: a.users[0]?.fullName || "-",
            email: a.users[0]?.email || "-",
            active: a.isActive ? "Yes" : "No",
            assessmentCount: factoryMap.get(a.id) || 0,
          }));

          return NextResponse.json({ data, pagination: { total, limit, offset, hasMore: offset + data.length < total } });
        }

        case "superadmin": {
          const userWhere: Record<string, unknown> = {
            userRoles: {
              some: { role: { name: "TPRMAdmin" } },
            },
          };
          if (search) {
            userWhere.OR = [
              { fullName: { contains: search, mode: "insensitive" } },
              { userName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ];
          }

          const [users, total] = await Promise.all([
            prisma.user.findMany({
              where: userWhere,
              select: {
                id: true,
                fullName: true,
                userName: true,
                email: true,
                isActive: true,
                lastLogin: true,
                customerAccount: { select: { name: true } },
              },
              orderBy: { userName: "asc" },
              take: limit,
              skip: offset,
            }),
            prisma.user.count({ where: userWhere }),
          ]);

          const data = users.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            username: u.userName,
            email: u.email,
            companyName: u.customerAccount?.name || "-",
            phoneNumber: "",
            lastLogin: u.lastLogin,
            active: u.isActive ? "Yes" : "No",
          }));

          return NextResponse.json({ data, pagination: { total, limit, offset, hasMore: offset + data.length < total } });
        }

        case "user-detail": {
          // Fetch full user details + customer account + subscription plans for editing
          const userId = searchParams.get("userId");
          if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              fullName: true,
              userName: true,
              email: true,
              language: true,
              timezone: true,
              isBlocked: true,
              isActive: true,
              role: true,
              customerAccountId: true,
              customerAccount: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                  subscriptionPlans: {
                    select: {
                      id: true,
                      startDate: true,
                      expiryDate: true,
                      maxFrameworksAllowed: true,
                      maxAccountsAllowed: true,
                      status: true,
                    },
                    orderBy: { startDate: "desc" },
                  },
                },
              },
            },
          });

          if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
          }

          // Get isGrcAdded via raw query
          let isGrcAdded = false;
          if (user.customerAccountId) {
            try {
              const flags = await prisma.$queryRawUnsafe<
                Array<{ isGrcAdded: boolean }>
              >(
                `SELECT "isGrcAdded" FROM "CustomerAccount" WHERE id = $1`,
                user.customerAccountId
              );
              if (flags.length > 0) isGrcAdded = flags[0].isGrcAdded;
            } catch {
              // Column may not exist yet
            }
          }

          // Get assessmentLimit/vendorLimit for each subscription plan via raw query
          const plans = user.customerAccount?.subscriptionPlans || [];
          let planExtras = new Map<string, { assessmentLimit: number; vendorLimit: number }>();
          if (plans.length > 0) {
            try {
              const planIds = plans.map((p) => p.id);
              const extras = await prisma.$queryRawUnsafe<
                Array<{ id: string; assessmentLimit: number; vendorLimit: number }>
              >(
                `SELECT id, "assessmentLimit", "vendorLimit" FROM "SubscriptionPlan" WHERE id IN (${planIds.map((_, i) => `$${i + 1}`).join(",")})`,
                ...planIds
              );
              planExtras = new Map(extras.map((e) => [e.id, { assessmentLimit: e.assessmentLimit || 0, vendorLimit: e.vendorLimit || 0 }]));
            } catch {
              // Columns may not exist yet
            }
          }

          return NextResponse.json({
            user: {
              id: user.id,
              fullName: user.fullName,
              userName: user.userName,
              email: user.email,
              language: user.language || "en-US",
              timeZone: user.timezone || "Asia/Qatar",
              blocked: user.isBlocked || false,
              active: user.isActive,
              role: user.role,
            },
            customerAccount: user.customerAccount ? {
              id: user.customerAccount.id,
              name: user.customerAccount.name,
              isGrcAdded,
            } : null,
            subscriptionPlans: plans.map((p) => {
              const extra = planExtras.get(p.id);
              return {
                id: p.id,
                startDate: p.startDate,
                expiryDate: p.expiryDate,
                maxFrameworks: p.maxFrameworksAllowed,
                maxAccounts: p.maxAccountsAllowed,
                assessmentLimit: extra?.assessmentLimit || 0,
                vendorLimit: extra?.vendorLimit || 0,
                status: p.status,
              };
            }),
          });
        }

        default:
          return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
      }
    } catch (error) {
      console.error("Error fetching account overview:", error);
      return NextResponse.json(
        { error: "Failed to fetch account overview" },
        { status: 500 }
      );
    }
  },
  { resource: "tprm.account-overview", action: "view" }
);

// ==================== POST — Create account + user with appropriate role ====================
// Each tab creates a SEPARATE customer account with its own admin user:
//   customers  -> CustomerAccount + User with CustomerAdministrator role (unified GRC+TPRM admin)
//   factory    -> CustomerAccount + User with FactoryAdmin role
//   superadmin -> CustomerAccount + User with TPRMAdmin role
export const POST = withAuth(
  async (req) => {
    try {
      const body = await req.json();
      const {
        tab, customerName, fullName, userName, email, password,
        isGrcAdded, language, timeZone, blocked, active,
        subscriptionPlans,
      } = body;

      if (!tab || !customerName || !fullName || !userName || !email || !password) {
        return NextResponse.json(
          { error: "Missing required fields: tab, customerName, fullName, userName, email, password" },
          { status: 400 }
        );
      }

      // Customer (CustomerAdministrator) accounts are now created exclusively
      // through the central Customer Accounts page (/grc/customer-accounts),
      // which provisions the module subscription correctly. The TPRM customers
      // tab is view/edit/delete only. Factory & Superadmin accounts are still
      // created here.
      if (tab === "customers") {
        return NextResponse.json(
          { error: "Customer accounts are created from the central Customer Accounts page." },
          { status: 400 }
        );
      }

      // Determine role name based on tab
      // CustomerAdministrator is the unified admin role for both GRC and TPRM;
      // module visibility is controlled by isGrcAdded/isTprmAdded flags on CustomerAccount
      const roleMap: Record<string, string> = {
        customers: "CustomerAdministrator",
        factory: "FactoryAdmin",
        superadmin: "TPRMAdmin",
      };
      const roleName = roleMap[tab];
      if (!roleName) {
        return NextResponse.json({ error: "Invalid tab for account creation" }, { status: 400 });
      }

      // Check for duplicate userName or email
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ userName }, { email }] },
      });
      if (existingUser) {
        const field = existingUser.userName === userName ? "Username" : "Email";
        return NextResponse.json({ error: `${field} already exists` }, { status: 409 });
      }

      // Find or create the role
      let roleRecord = await prisma.role.findFirst({ where: { name: roleName } });
      if (!roleRecord) {
        roleRecord = await prisma.role.create({
          data: { name: roleName, description: `${roleName} role`, isSystem: false },
        });
      }

      // Generate next account code
      const nextCode = await generateNextAccountCode();

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Split fullName into first/last
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || fullName;
      const lastName = nameParts.slice(1).join(" ") || firstName;

      // Create account + user + subscription plans in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create the CustomerAccount
        const customerAccount = await tx.customerAccount.create({
          data: {
            code: nextCode,
            name: customerName,
            isActive: active !== false,
          },
        });
        // Set isGrcAdded/isTprmAdded via raw SQL (Prisma client may not have these fields yet)
        await tx.$executeRawUnsafe(
          `UPDATE "CustomerAccount" SET "isTprmAdded" = $1, "isGrcAdded" = $2 WHERE id = $3`,
          true, isGrcAdded === true, customerAccount.id
        );

        // 2. Create the User linked to the new account.
        // Tag the UserRole with moduleCode so the user's session.roleModules
        // picks up the right workspace(s). Without this, the layout gate
        // computes available = subscription ∩ has-role as empty and the
        // user is redirected to /subscription-required on first login.
        // All three tabs (customers / factory / superadmin) live in the
        // TPRM workspace, so TPRM is always tagged; GRC is added when the
        // new account is dual-module.
        const user = await tx.user.create({
          data: {
            userId: `USR-${Date.now()}-${userName.substring(0, 4).toUpperCase()}`,
            userName,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            fullName,
            role: roleName,
            customerCode: nextCode,
            customerAccountId: customerAccount.id,
            isBlocked: blocked || false,
            isActive: active !== false,
            language: language || "en-US",
            timezone: timeZone || "Asia/Qatar",
            userRoles: {
              create: { roleId: roleRecord.id, moduleCode: "TPRM" },
            },
          },
          include: {
            userRoles: { include: { role: true } },
          },
        });
        if (isGrcAdded === true) {
          // Dual-module customer admin: also let them into the GRC workspace.
          await tx.userRole.create({
            data: { userId: user.id, roleId: roleRecord.id, moduleCode: "GRC" },
          });
        }

        // 3. Create SubscriptionPlans if provided
        const createdPlans = [];
        if (subscriptionPlans && Array.isArray(subscriptionPlans)) {
          for (const plan of subscriptionPlans) {
            const createdPlan = await tx.subscriptionPlan.create({
              data: {
                customerAccountId: customerAccount.id,
                startDate: new Date(plan.startDate),
                expiryDate: new Date(plan.expiryDate),
                maxFrameworksAllowed: plan.maxFrameworks || 0,
                maxAccountsAllowed: plan.maxAccounts || 0,
                frameworksUsed: 0,
                accountsUsed: 0,
                status: plan.status || "Active",
              },
            });
            // Set assessmentLimit/vendorLimit via raw SQL (Prisma client may not have these fields yet)
            await tx.$executeRawUnsafe(
              `UPDATE "SubscriptionPlan" SET "assessmentLimit" = $1, "vendorLimit" = $2 WHERE id = $3`,
              plan.assessmentLimit || 0, plan.vendorLimit || 0, createdPlan.id
            );
            createdPlans.push(createdPlan);
          }
        }

        return { customerAccount, user, createdPlans };
      });

      // Provision Subscription + ModuleSubscription rows for the new account
      // so getAccessSnapshot() returns the right module flags on first login.
      // Without this, the user lands on /subscription-required even though the
      // legacy SubscriptionPlan row exists. Idempotent — skips already-active
      // module rows. Failure here shouldn't block account creation, so the
      // error is logged and swallowed.
      const enabledModules: ModuleCode[] = ["TPRM"];
      if (isGrcAdded === true) enabledModules.push("GRC");
      try {
        await ensureComplimentarySubscription(result.customerAccount.id, enabledModules);
      } catch (subErr) {
        console.error("[Account-overview POST] Failed to provision subscription:", subErr);
      }

      // Remove password from response
      const { password: _, ...safeUser } = result.user;

      // Trigger dynamic translation for customer account and user
      if (result.customerAccount.id) {
        void translateRecord(result.customerAccount.id, 'CustomerAccount', result.customerAccount.id, { name: result.customerAccount.name });
        void translateRecord(result.customerAccount.id, 'User', result.user.id, {
          fullName: result.user.fullName,
          firstName: result.user.firstName,
          lastName: result.user.lastName || '',
        });
      }

      return NextResponse.json({
        success: true,
        user: safeUser,
        customerAccount: {
          id: result.customerAccount.id,
          code: result.customerAccount.code,
          name: result.customerAccount.name,
        },
        subscriptionPlans: result.createdPlans.length,
      }, { status: 201 });
    } catch (error) {
      console.error("Error creating TPRM account:", error);
      // Handle Prisma unique constraint violations
      if ((error as { code?: string }).code === "P2002") {
        const target = (error as { meta?: { target?: string[] } }).meta?.target;
        if (target?.includes("userName")) {
          return NextResponse.json({ error: "Username already exists" }, { status: 409 });
        }
        if (target?.includes("email")) {
          return NextResponse.json({ error: "Email already exists" }, { status: 409 });
        }
        if (target?.includes("code")) {
          return NextResponse.json({ error: "Account code collision. Please try again." }, { status: 409 });
        }
        return NextResponse.json({ error: `Duplicate value: ${target?.join(", ") || "unknown"}` }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }
  },
  { resource: "tprm.account-overview", action: "create" }
);

// ==================== PATCH — Update user + account details ====================
export const PATCH = withAuth(
  async (req) => {
    try {
      const body = await req.json();
      const {
        userId, fullName, email, language, timeZone, blocked, active,
        customerName, isGrcAdded, password,
        addSubscriptionPlans, deleteSubscriptionPlanIds,
      } = body;

      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }

      // Verify user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, customerAccountId: true },
      });
      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Check for duplicate email if changed
      if (email && email !== existingUser.email) {
        const emailExists = await prisma.user.findFirst({
          where: { email, id: { not: userId } },
        });
        if (emailExists) {
          return NextResponse.json({ error: "Email already exists" }, { status: 409 });
        }
      }

      await prisma.$transaction(async (tx) => {
        // 1. Update user fields
        const updateData: Record<string, unknown> = {};
        if (fullName !== undefined) {
          updateData.fullName = fullName;
          const nameParts = fullName.trim().split(/\s+/);
          updateData.firstName = nameParts[0] || fullName;
          updateData.lastName = nameParts.slice(1).join(" ") || nameParts[0];
        }
        if (email !== undefined) updateData.email = email;
        if (language !== undefined) updateData.language = language;
        if (timeZone !== undefined) updateData.timezone = timeZone;
        if (blocked !== undefined) updateData.isBlocked = blocked;
        if (active !== undefined) updateData.isActive = active;

        // Hash and update password if provided
        if (password) {
          updateData.password = await bcrypt.hash(password, 10);
        }

        if (Object.keys(updateData).length > 0) {
          await tx.user.update({ where: { id: userId }, data: updateData });
        }

        // 2. Update CustomerAccount fields if applicable
        const accountId = existingUser.customerAccountId;
        if (accountId) {
          if (customerName !== undefined) {
            await tx.customerAccount.update({
              where: { id: accountId },
              data: { name: customerName },
            });
          }
          if (isGrcAdded !== undefined) {
            try {
              await tx.$executeRawUnsafe(
                `UPDATE "CustomerAccount" SET "isGrcAdded" = $1 WHERE id = $2`,
                isGrcAdded, accountId
              );
            } catch {
              // Column may not exist yet
            }
          }

          // 3. Delete subscription plans if requested
          if (deleteSubscriptionPlanIds && Array.isArray(deleteSubscriptionPlanIds) && deleteSubscriptionPlanIds.length > 0) {
            await tx.subscriptionPlan.deleteMany({
              where: { id: { in: deleteSubscriptionPlanIds }, customerAccountId: accountId },
            });
          }

          // 4. Add new subscription plans if provided
          if (addSubscriptionPlans && Array.isArray(addSubscriptionPlans)) {
            for (const plan of addSubscriptionPlans) {
              const createdPlan = await tx.subscriptionPlan.create({
                data: {
                  customerAccountId: accountId,
                  startDate: new Date(plan.startDate),
                  expiryDate: new Date(plan.expiryDate),
                  maxFrameworksAllowed: plan.maxFrameworks || 0,
                  maxAccountsAllowed: plan.maxAccounts || 0,
                  frameworksUsed: 0,
                  accountsUsed: 0,
                  status: plan.status || "Active",
                },
              });
              await tx.$executeRawUnsafe(
                `UPDATE "SubscriptionPlan" SET "assessmentLimit" = $1, "vendorLimit" = $2 WHERE id = $3`,
                plan.assessmentLimit || 0, plan.vendorLimit || 0, createdPlan.id
              );
            }
          }
        }
      });

      // Trigger dynamic translation for updated fields
      if (existingUser.customerAccountId) {
        if (customerName) {
          void translateRecord(existingUser.customerAccountId, 'CustomerAccount', existingUser.customerAccountId, { name: customerName });
        }
        if (fullName) {
          const nameParts = fullName.trim().split(/\s+/);
          void translateRecord(existingUser.customerAccountId, 'User', userId, {
            fullName,
            firstName: nameParts[0] || fullName,
            lastName: nameParts.slice(1).join(' ') || '',
          });
        }
      }

      return NextResponse.json({ success: true, customerAccountId: existingUser.customerAccountId });
    } catch (error) {
      console.error("Error updating user:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
  },
  { resource: "tprm.account-overview", action: "edit" }
);

// ==================== DELETE — Delete account + associated users ====================
export const DELETE = withAuth(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const tab = searchParams.get("tab");
      const accountId = searchParams.get("accountId");
      const userId = searchParams.get("userId");

      if (!tab) {
        return NextResponse.json({ error: "tab is required" }, { status: 400 });
      }

      if (tab === "superadmin") {
        // For super admin tab, delete the user directly
        if (!userId) {
          return NextResponse.json({ error: "userId is required for superadmin delete" }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
          // Delete user roles first
          await tx.userRole.deleteMany({ where: { userId } });
          // Delete the user
          await tx.user.delete({ where: { id: userId } });
        });

        return NextResponse.json({ success: true });
      }

      // For customers and factory tabs, delete the customer account and all associated data
      if (!accountId) {
        return NextResponse.json({ error: "accountId is required" }, { status: 400 });
      }

      // Verify the account exists
      const account = await prisma.customerAccount.findUnique({
        where: { id: accountId },
        select: { id: true, name: true },
      });
      if (!account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        // 1. Delete user roles for all users in this account
        const accountUsers = await tx.user.findMany({
          where: { customerAccountId: accountId },
          select: { id: true },
        });
        const userIds = accountUsers.map((u) => u.id);

        if (userIds.length > 0) {
          await tx.userRole.deleteMany({ where: { userId: { in: userIds } } });
          // Delete OAuth accounts
          await tx.oAuthAccount.deleteMany({ where: { userId: { in: userIds } } });
        }

        // 2. Delete TPRM-related data
        await tx.tPRMAssessmentLog.deleteMany({
          where: { assessment: { customerAccountId: accountId } },
        });
        await tx.tPRMAssessment.deleteMany({ where: { customerAccountId: accountId } });
        await tx.tPRMVendor.deleteMany({ where: { customerAccountId: accountId } });

        // 3. Delete TPRM configurations
        try {
          await tx.$executeRawUnsafe(
            `DELETE FROM "TPRMConfiguration" WHERE "customerAccountId" = $1`,
            accountId
          );
        } catch {
          // Table may not exist yet
        }

        // 4. Delete subscription plans
        await tx.subscriptionPlan.deleteMany({ where: { customerAccountId: accountId } });

        // 5. Delete users
        if (userIds.length > 0) {
          await tx.user.deleteMany({ where: { id: { in: userIds } } });
        }

        // 6. Delete the customer account itself
        await tx.customerAccount.delete({ where: { id: accountId } });
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting account:", error);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }
  },
  { resource: "tprm.account-overview", action: "delete" }
);
