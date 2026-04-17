import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

// Valid configuration types
const VALID_TYPES = [
  'vendor-profile-fields',
  'onboarding-questions',
  'service-categories',
  'disciplines',
  'departments',
  'questionnaire-templates',
  'offboarding-questions',
  'scorecard-factors',
  'scorecard-config',
] as const;

type ConfigType = typeof VALID_TYPES[number];

// Default system vendor profile fields (cannot be edited or deleted)
const SYSTEM_PROFILE_FIELDS = [
  'Vendor Name',
  'Vendor URL',
  'Account Manager Name',
  'Account Manager Email',
  'Contact Number',
  'Service Description',
  'Service Category',
];

// Default scorecard factors
const DEFAULT_SECURITY_POSTURE_FACTORS = [
  { factorId: 'network_security', name: 'Network Security', sortOrder: 1 },
  { factorId: 'dns_health', name: 'DNS Health', sortOrder: 2 },
  { factorId: 'patching_cadence', name: 'Patching Cadence', sortOrder: 3 },
  { factorId: 'endpoint_security', name: 'Endpoint Security', sortOrder: 4 },
  { factorId: 'ip_reputation', name: 'IP Reputation', sortOrder: 5 },
  { factorId: 'application_security', name: 'Application Security', sortOrder: 6 },
  { factorId: 'cubit_score', name: 'Cubit Score', sortOrder: 7 },
  { factorId: 'email_security', name: 'Email Security', sortOrder: 8 },
  { factorId: 'ssl_tls_config', name: 'SSL/TLS Configuration', sortOrder: 9 },
  { factorId: 'privacy', name: 'Privacy', sortOrder: 10 },
];

const DEFAULT_THREAT_EXPOSURE_FACTORS = [
  { factorId: 'known_breach', name: 'Known Breach', sortOrder: 1 },
  { factorId: 'hacker_chatter', name: 'Hacker Chatter', sortOrder: 2 },
  { factorId: 'information_leak', name: 'Information Leak', sortOrder: 3 },
  { factorId: 'social_engineering', name: 'Social Engineering', sortOrder: 4 },
];

// ============ GET ============
export const GET = withAuth(
  async (req: NextRequest, context: { params: Promise<{ type: string }> }, session) => {
    try {
      const { type } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      if (!VALID_TYPES.includes(type as ConfigType)) {
        return NextResponse.json({ error: 'Invalid configuration type' }, { status: 400 });
      }

      switch (type as ConfigType) {
        case 'vendor-profile-fields': {
          // Ensure system fields are in sync (adds missing, removes stale)
          await ensureSystemProfileFields(customerAccountId);
          const fields = await prisma.tPRMVendorProfileField.findMany({
            where: { customerAccountId },
            orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }],
          });
          return NextResponse.json(fields);
        }

        case 'onboarding-questions': {
          const questions = await prisma.tPRMOnboardingQuestion.findMany({
            where: { customerAccountId },
            orderBy: { sortOrder: 'asc' },
            include: { children: true },
          });
          return NextResponse.json(questions);
        }

        case 'service-categories': {
          const categories = await prisma.tPRMServiceCategory.findMany({
            where: { customerAccountId },
            orderBy: { name: 'asc' },
          });
          return NextResponse.json(categories);
        }

        case 'disciplines': {
          const disciplines = await prisma.tPRMDiscipline.findMany({
            where: { customerAccountId },
            orderBy: { name: 'asc' },
          });
          return NextResponse.json(disciplines);
        }

        case 'departments': {
          const departments = await prisma.tPRMDepartment.findMany({
            where: { customerAccountId },
            orderBy: { name: 'asc' },
          });
          return NextResponse.json(departments);
        }

        case 'questionnaire-templates': {
          const templates = await prisma.tPRMQuestionnaireTemplate.findMany({
            where: { customerAccountId },
            orderBy: { createdAt: 'desc' },
          });
          return NextResponse.json(templates);
        }

        case 'offboarding-questions': {
          const questions = await prisma.tPRMOffboardingQuestion.findMany({
            where: { customerAccountId },
            orderBy: { sequenceNo: 'asc' },
          });
          return NextResponse.json(questions);
        }

        case 'scorecard-factors': {
          // Ensure default factors exist in DB (auto-creates on first access)
          await ensureScorecardFactors(customerAccountId);
          const factors = await prisma.tPRMScorecardFactor.findMany({
            where: { customerAccountId },
            orderBy: { sortOrder: 'asc' },
          });
          return NextResponse.json(factors);
        }

        case 'scorecard-config': {
          // Return the scorecard formula config from TPRMConfiguration
          const config = await prisma.tPRMConfiguration.findUnique({
            where: { customerAccountId },
            select: {
              scoringFormula: true,
              securityPostureWeight: true,
              threatExposureWeight: true,
            },
          });
          return NextResponse.json(config || {
            scoringFormula: 'AVG',
            securityPostureWeight: 50,
            threatExposureWeight: 50,
          });
        }

        default:
          return NextResponse.json({ error: 'Invalid configuration type' }, { status: 400 });
      }
    } catch (error) {
      console.error('Configurations GET error:', error);
      return NextResponse.json({ error: 'Unable to load configuration data. Please refresh and try again.' }, { status: 500 });
    }
  },
  { resource: ['tprm.configurations', 'tprm.bo-inventory', 'tprm.rm-inventory', 'tprm.asr-monitoring'], action: 'view' }
);

// ============ POST ============
export const POST = withAuth(
  async (req: NextRequest, context: { params: Promise<{ type: string }> }, session) => {
    try {
      const { type } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();

      if (!VALID_TYPES.includes(type as ConfigType)) {
        return NextResponse.json({ error: 'Invalid configuration type' }, { status: 400 });
      }

      switch (type as ConfigType) {
        case 'vendor-profile-fields': {
          const { fieldName } = body;
          if (!fieldName?.trim()) {
            return NextResponse.json({ error: 'Field name is required' }, { status: 400 });
          }
          // Ensure system fields exist first
          await ensureSystemProfileFields(customerAccountId);
          const maxOrder = await prisma.tPRMVendorProfileField.aggregate({
            where: { customerAccountId },
            _max: { sortOrder: true },
          });
          const field = await prisma.tPRMVendorProfileField.create({
            data: {
              customerAccountId,
              fieldName: fieldName.trim(),
              isSystem: false,
              sortOrder: (maxOrder._max.sortOrder || 0) + 1,
            },
          });
          void translateRecord(customerAccountId, 'TPRMVendorProfileField', field.id, { fieldName: field.fieldName });
          return NextResponse.json(field, { status: 201 });
        }

        case 'onboarding-questions': {
          const { title, question, score, questionType, responseType, parentId } = body;
          if (!title?.trim()) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
          }
          const maxOrder = await prisma.tPRMOnboardingQuestion.aggregate({
            where: { customerAccountId },
            _max: { sortOrder: true },
          });
          const q = await prisma.tPRMOnboardingQuestion.create({
            data: {
              customerAccountId,
              title: title.trim(),
              question: question?.trim() || null,
              score: score || 0,
              questionType: questionType || 'Parent',
              responseType: responseType || 'Yes/No',
              parentId: parentId || null,
              sortOrder: (maxOrder._max.sortOrder || 0) + 1,
            },
          });
          void translateRecord(customerAccountId, 'TPRMOnboardingQuestion', q.id, { title: q.title, question: q.question });
          return NextResponse.json(q, { status: 201 });
        }

        case 'service-categories': {
          const { name } = body;
          if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
          }
          const cat = await prisma.tPRMServiceCategory.create({
            data: { customerAccountId, name: name.trim() },
          });
          void translateRecord(customerAccountId, 'TPRMServiceCategory', cat.id, { name: cat.name });
          return NextResponse.json(cat, { status: 201 });
        }

        case 'disciplines': {
          const { name } = body;
          if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
          }
          const disc = await prisma.tPRMDiscipline.create({
            data: { customerAccountId, name: name.trim() },
          });
          void translateRecord(customerAccountId, 'TPRMDiscipline', disc.id, { name: disc.name });
          return NextResponse.json(disc, { status: 201 });
        }

        case 'departments': {
          const { name } = body;
          if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
          }
          const dept = await prisma.tPRMDepartment.create({
            data: { customerAccountId, name: name.trim() },
          });
          if (customerAccountId) void translateRecord(customerAccountId, 'TPRMDepartment', dept.id, { name: dept.name });
          return NextResponse.json(dept, { status: 201 });
        }

        case 'questionnaire-templates': {
          const { templateName, frameworkName, templateCategory, imageUrl, vendorProfileQuestionIds } = body;
          if (!templateName?.trim()) {
            return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
          }
          const template = await prisma.tPRMQuestionnaireTemplate.create({
            data: {
              customerAccountId,
              templateName: templateName.trim(),
              frameworkName: frameworkName?.trim() || null,
              templateCategory: templateCategory || 'Default',
              imageUrl: imageUrl || null,
              vendorProfileQuestionIds: vendorProfileQuestionIds || null,
            },
          });
          void translateRecord(customerAccountId, 'TPRMQuestionnaireTemplate', template.id, { templateName: template.templateName, frameworkName: template.frameworkName });
          return NextResponse.json(template, { status: 201 });
        }

        case 'offboarding-questions': {
          const { title, question } = body;
          if (!title?.trim()) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
          }
          const maxSeq = await prisma.tPRMOffboardingQuestion.aggregate({
            where: { customerAccountId },
            _max: { sequenceNo: true },
          });
          const q = await prisma.tPRMOffboardingQuestion.create({
            data: {
              customerAccountId,
              sequenceNo: (maxSeq._max.sequenceNo || 0) + 1,
              title: title.trim(),
              question: question?.trim() || null,
              sortOrder: (maxSeq._max.sequenceNo || 0) + 1,
            },
          });
          void translateRecord(customerAccountId, 'TPRMOffboardingQuestion', q.id, { title: q.title, question: q.question });
          return NextResponse.json(q, { status: 201 });
        }

        case 'scorecard-factors': {
          const { factorId, name, weightage, isMandatory, scoreType } = body;
          if (!name?.trim() || !scoreType) {
            return NextResponse.json({ error: 'Name and score type are required' }, { status: 400 });
          }
          // Ensure default factors exist
          await ensureScorecardFactors(customerAccountId);
          const maxOrder = await prisma.tPRMScorecardFactor.aggregate({
            where: { customerAccountId, scoreType },
            _max: { sortOrder: true },
          });
          const factor = await prisma.tPRMScorecardFactor.create({
            data: {
              customerAccountId,
              factorId: factorId || name.trim().toLowerCase().replace(/\s+/g, '_'),
              name: name.trim(),
              weightage: weightage || 0,
              isMandatory: isMandatory ?? true,
              scoreType,
              isSystem: false,
              sortOrder: (maxOrder._max.sortOrder || 0) + 1,
            },
          });
          void translateRecord(customerAccountId, 'TPRMScorecardFactor', factor.id, { name: factor.name });
          return NextResponse.json(factor, { status: 201 });
        }

        case 'scorecard-config': {
          // Update scorecard formula config on TPRMConfiguration
          const { scoringFormula, securityPostureWeight, threatExposureWeight } = body;
          const config = await prisma.tPRMConfiguration.upsert({
            where: { customerAccountId },
            update: {
              ...(scoringFormula !== undefined && { scoringFormula }),
              ...(securityPostureWeight !== undefined && { securityPostureWeight }),
              ...(threatExposureWeight !== undefined && { threatExposureWeight }),
            },
            create: {
              customerAccountId,
              scoringFormula: scoringFormula || 'AVG',
              securityPostureWeight: securityPostureWeight ?? 50,
              threatExposureWeight: threatExposureWeight ?? 50,
            },
          });
          return NextResponse.json({
            scoringFormula: config.scoringFormula,
            securityPostureWeight: config.securityPostureWeight,
            threatExposureWeight: config.threatExposureWeight,
          });
        }

        default:
          return NextResponse.json({ error: 'Invalid configuration type' }, { status: 400 });
      }
    } catch (error: unknown) {
      console.error('Configurations POST error:', error);
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
        return NextResponse.json({ error: 'A record with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 });
    }
  },
  { resource: 'tprm.configurations', action: 'create' }
);

// ============ PATCH ============
export const PATCH = withAuth(
  async (req: NextRequest, context: { params: Promise<{ type: string }> }, session) => {
    try {
      const { type } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id } = body;

      if (!VALID_TYPES.includes(type as ConfigType)) {
        return NextResponse.json({ error: 'Invalid configuration type' }, { status: 400 });
      }

      if (!id && type !== 'scorecard-config') {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
      }

      switch (type as ConfigType) {
        case 'vendor-profile-fields': {
          const { fieldName } = body;
          const existing = await prisma.tPRMVendorProfileField.findFirst({ where: { id, customerAccountId } });
          if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          if (existing.isSystem) return NextResponse.json({ error: 'System fields cannot be edited' }, { status: 403 });
          const field = await prisma.tPRMVendorProfileField.update({
            where: { id },
            data: { ...(fieldName !== undefined && { fieldName: fieldName.trim() }) },
          });
          void translateRecord(customerAccountId, 'TPRMVendorProfileField', field.id, { fieldName: field.fieldName });
          return NextResponse.json(field);
        }

        case 'onboarding-questions': {
          const { title, question, score, questionType, responseType, parentId } = body;
          const existing = await prisma.tPRMOnboardingQuestion.findFirst({ where: { id, customerAccountId } });
          if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          const q = await prisma.tPRMOnboardingQuestion.update({
            where: { id },
            data: {
              ...(title !== undefined && { title: title.trim() }),
              ...(question !== undefined && { question: question?.trim() || null }),
              ...(score !== undefined && { score }),
              ...(questionType !== undefined && { questionType }),
              ...(responseType !== undefined && { responseType }),
              ...(parentId !== undefined && { parentId: parentId || null }),
            },
          });
          void translateRecord(customerAccountId, 'TPRMOnboardingQuestion', q.id, { title: q.title, question: q.question });
          return NextResponse.json(q);
        }

        case 'service-categories': {
          const { name } = body;
          const existing = await prisma.tPRMServiceCategory.findFirst({ where: { id, customerAccountId } });
          if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          const cat = await prisma.tPRMServiceCategory.update({
            where: { id },
            data: { ...(name !== undefined && { name: name.trim() }) },
          });
          void translateRecord(customerAccountId, 'TPRMServiceCategory', cat.id, { name: cat.name });
          return NextResponse.json(cat);
        }

        case 'disciplines': {
          const { name } = body;
          const existing = await prisma.tPRMDiscipline.findFirst({ where: { id, customerAccountId } });
          if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          const disc = await prisma.tPRMDiscipline.update({
            where: { id },
            data: { ...(name !== undefined && { name: name.trim() }) },
          });
          void translateRecord(customerAccountId, 'TPRMDiscipline', disc.id, { name: disc.name });
          return NextResponse.json(disc);
        }

        case 'departments': {
          const { name } = body;
          const existing = await prisma.tPRMDepartment.findFirst({ where: { id, customerAccountId } });
          if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          const dept = await prisma.tPRMDepartment.update({
            where: { id },
            data: { ...(name !== undefined && { name: name.trim() }) },
          });
          if (customerAccountId) void translateRecord(customerAccountId, 'TPRMDepartment', dept.id, { name: dept.name });
          return NextResponse.json(dept);
        }

        case 'questionnaire-templates': {
          const { templateName, frameworkName, templateCategory, imageUrl, vendorProfileQuestionIds } = body;
          const existing = await prisma.tPRMQuestionnaireTemplate.findFirst({ where: { id, customerAccountId } });
          if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          const template = await prisma.tPRMQuestionnaireTemplate.update({
            where: { id },
            data: {
              ...(templateName !== undefined && { templateName: templateName.trim() }),
              ...(frameworkName !== undefined && { frameworkName: frameworkName?.trim() || null }),
              ...(templateCategory !== undefined && { templateCategory }),
              ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
              ...(vendorProfileQuestionIds !== undefined && { vendorProfileQuestionIds }),
            },
          });
          void translateRecord(customerAccountId, 'TPRMQuestionnaireTemplate', template.id, { templateName: template.templateName, frameworkName: template.frameworkName });
          return NextResponse.json(template);
        }

        case 'offboarding-questions': {
          const { title, question, sequenceNo } = body;
          const existing = await prisma.tPRMOffboardingQuestion.findFirst({ where: { id, customerAccountId } });
          if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          const q = await prisma.tPRMOffboardingQuestion.update({
            where: { id },
            data: {
              ...(title !== undefined && { title: title.trim() }),
              ...(question !== undefined && { question: question?.trim() || null }),
              ...(sequenceNo !== undefined && { sequenceNo }),
            },
          });
          void translateRecord(customerAccountId, 'TPRMOffboardingQuestion', q.id, { title: q.title, question: q.question });
          return NextResponse.json(q);
        }

        case 'scorecard-factors': {
          const { name, weightage, isMandatory, factorId, scoreType } = body;

          // If ID starts with "default_", the factors haven't been persisted yet
          if (id.startsWith('default_')) {
            // Persist all defaults to DB first
            await ensureScorecardFactors(customerAccountId);
            // Now find the real record by factorId + scoreType
            if (!factorId || !scoreType) {
              return NextResponse.json({ error: 'factorId and scoreType required for default factors' }, { status: 400 });
            }
            const real = await prisma.tPRMScorecardFactor.findFirst({
              where: { customerAccountId, factorId, scoreType },
            });
            if (!real) return NextResponse.json({ error: 'Factor not found after initialization' }, { status: 404 });
            const factor = await prisma.tPRMScorecardFactor.update({
              where: { id: real.id },
              data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(weightage !== undefined && { weightage }),
                ...(isMandatory !== undefined && { isMandatory }),
              },
            });
            if (customerAccountId) void translateRecord(customerAccountId, 'TPRMScorecardFactor', factor.id, { name: factor.name });
            return NextResponse.json(factor);
          }

          const existing = await prisma.tPRMScorecardFactor.findFirst({ where: { id, customerAccountId } });
          if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          const factor = await prisma.tPRMScorecardFactor.update({
            where: { id },
            data: {
              ...(name !== undefined && { name: name.trim() }),
              ...(weightage !== undefined && { weightage }),
              ...(isMandatory !== undefined && { isMandatory }),
            },
          });
          if (customerAccountId) void translateRecord(customerAccountId, 'TPRMScorecardFactor', factor.id, { name: factor.name });
          return NextResponse.json(factor);
        }

        case 'scorecard-config': {
          // Same as POST — upsert
          const { scoringFormula, securityPostureWeight, threatExposureWeight } = body;
          const config = await prisma.tPRMConfiguration.upsert({
            where: { customerAccountId },
            update: {
              ...(scoringFormula !== undefined && { scoringFormula }),
              ...(securityPostureWeight !== undefined && { securityPostureWeight }),
              ...(threatExposureWeight !== undefined && { threatExposureWeight }),
            },
            create: {
              customerAccountId,
              scoringFormula: scoringFormula || 'AVG',
              securityPostureWeight: securityPostureWeight ?? 50,
              threatExposureWeight: threatExposureWeight ?? 50,
            },
          });
          return NextResponse.json({
            scoringFormula: config.scoringFormula,
            securityPostureWeight: config.securityPostureWeight,
            threatExposureWeight: config.threatExposureWeight,
          });
        }

        default:
          return NextResponse.json({ error: 'Invalid configuration type' }, { status: 400 });
      }
    } catch (error: unknown) {
      console.error('Configurations PATCH error:', error);
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
        return NextResponse.json({ error: 'A record with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
    }
  },
  { resource: 'tprm.configurations', action: 'edit' }
);

// ============ DELETE ============
export const DELETE = withAuth(
  async (req: NextRequest, context: { params: Promise<{ type: string }> }, session) => {
    try {
      const { type } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      const deleteAll = searchParams.get('deleteAll') === 'true';

      if (!VALID_TYPES.includes(type as ConfigType)) {
        return NextResponse.json({ error: 'Invalid configuration type' }, { status: 400 });
      }

      // Handle "delete all" for service categories
      if (deleteAll) {
        switch (type as ConfigType) {
          case 'service-categories':
            await prisma.tPRMServiceCategory.deleteMany({ where: { customerAccountId } });
            return NextResponse.json({ success: true });
          case 'offboarding-questions':
            await prisma.tPRMOffboardingQuestion.deleteMany({ where: { customerAccountId } });
            return NextResponse.json({ success: true });
          default:
            return NextResponse.json({ error: 'Delete all not supported for this type' }, { status: 400 });
        }
      }

      if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
      }

      switch (type as ConfigType) {
        case 'vendor-profile-fields': {
          // Cannot delete system fields
          const field = await prisma.tPRMVendorProfileField.findFirst({
            where: { id, customerAccountId },
          });
          if (!field) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          if (field.isSystem) return NextResponse.json({ error: 'System fields cannot be deleted' }, { status: 403 });
          await prisma.tPRMVendorProfileField.delete({ where: { id } });
          return NextResponse.json({ success: true });
        }

        case 'onboarding-questions': {
          const question = await prisma.tPRMOnboardingQuestion.findFirst({ where: { id, customerAccountId } });
          if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          // Delete children first
          const children = await prisma.tPRMOnboardingQuestion.findMany({ where: { parentId: id, customerAccountId }, select: { id: true } });
          await prisma.tPRMOnboardingQuestion.deleteMany({
            where: { parentId: id, customerAccountId },
          });
          for (const child of children) {
            void deleteRecordTranslations(customerAccountId, 'TPRMOnboardingQuestion', child.id);
          }
          await prisma.tPRMOnboardingQuestion.delete({ where: { id } });
          void deleteRecordTranslations(customerAccountId, 'TPRMOnboardingQuestion', id);
          return NextResponse.json({ success: true });
        }

        case 'service-categories': {
          const cat = await prisma.tPRMServiceCategory.findFirst({ where: { id, customerAccountId } });
          if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          await prisma.tPRMServiceCategory.delete({ where: { id } });
          void deleteRecordTranslations(customerAccountId, 'TPRMServiceCategory', id);
          return NextResponse.json({ success: true });
        }

        case 'disciplines': {
          const disc = await prisma.tPRMDiscipline.findFirst({ where: { id, customerAccountId } });
          if (!disc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          await prisma.tPRMDiscipline.delete({ where: { id } });
          void deleteRecordTranslations(customerAccountId, 'TPRMDiscipline', id);
          return NextResponse.json({ success: true });
        }

        case 'departments': {
          const dept = await prisma.tPRMDepartment.findFirst({ where: { id, customerAccountId } });
          if (!dept) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          await prisma.tPRMDepartment.delete({ where: { id } });
          return NextResponse.json({ success: true });
        }

        case 'questionnaire-templates': {
          const tmpl = await prisma.tPRMQuestionnaireTemplate.findFirst({ where: { id, customerAccountId } });
          if (!tmpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          await prisma.tPRMQuestionnaireTemplate.delete({ where: { id } });
          void deleteRecordTranslations(customerAccountId, 'TPRMQuestionnaireTemplate', id);
          return NextResponse.json({ success: true });
        }

        case 'offboarding-questions': {
          const obq = await prisma.tPRMOffboardingQuestion.findFirst({ where: { id, customerAccountId } });
          if (!obq) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          await prisma.tPRMOffboardingQuestion.delete({ where: { id } });
          void deleteRecordTranslations(customerAccountId, 'TPRMOffboardingQuestion', id);
          return NextResponse.json({ success: true });
        }

        case 'scorecard-factors': {
          const factor = await prisma.tPRMScorecardFactor.findFirst({
            where: { id, customerAccountId },
          });
          if (!factor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          if (factor.isSystem) return NextResponse.json({ error: 'System factors cannot be deleted' }, { status: 403 });
          await prisma.tPRMScorecardFactor.delete({ where: { id } });
          void deleteRecordTranslations(customerAccountId, 'TPRMScorecardFactor', id);
          return NextResponse.json({ success: true });
        }

        default:
          return NextResponse.json({ error: 'Delete not supported for this type' }, { status: 400 });
      }
    } catch (error) {
      console.error('Configurations DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 });
    }
  },
  { resource: 'tprm.configurations', action: 'delete' }
);

// ============ HELPERS ============

/** Ensure system vendor profile fields are created for this tenant and synced with SYSTEM_PROFILE_FIELDS */
async function ensureSystemProfileFields(customerAccountId: string) {
  const existing = await prisma.tPRMVendorProfileField.findMany({
    where: { customerAccountId, isSystem: true },
  });

  const existingNames = new Set(existing.map(f => f.fieldName));
  const desiredNames = new Set(SYSTEM_PROFILE_FIELDS);

  // Delete system fields that are no longer in the list
  const toDelete = existing.filter(f => !desiredNames.has(f.fieldName));
  if (toDelete.length > 0) {
    await prisma.tPRMVendorProfileField.deleteMany({
      where: { id: { in: toDelete.map(f => f.id) } },
    });
  }

  // Add missing system fields
  const toAdd = SYSTEM_PROFILE_FIELDS.filter(name => !existingNames.has(name));
  if (toAdd.length > 0) {
    const maxOrder = await prisma.tPRMVendorProfileField.aggregate({
      where: { customerAccountId },
      _max: { sortOrder: true },
    });
    let nextOrder = (maxOrder._max.sortOrder || 0) + 1;
    await prisma.tPRMVendorProfileField.createMany({
      data: toAdd.map((name) => ({
        customerAccountId,
        fieldName: name,
        isSystem: true,
        sortOrder: nextOrder++,
      })),
      skipDuplicates: true,
    });
  }
}

/** Ensure default scorecard factors are created for this tenant */
async function ensureScorecardFactors(customerAccountId: string) {
  const existing = await prisma.tPRMScorecardFactor.count({
    where: { customerAccountId },
  });
  if (existing > 0) return;

  const allFactors = [
    ...DEFAULT_SECURITY_POSTURE_FACTORS.map((f) => ({
      customerAccountId,
      factorId: f.factorId,
      name: f.name,
      weightage: 0,
      isMandatory: true,
      scoreType: 'SecurityPosture',
      isSystem: true,
      sortOrder: f.sortOrder,
    })),
    ...DEFAULT_THREAT_EXPOSURE_FACTORS.map((f) => ({
      customerAccountId,
      factorId: f.factorId,
      name: f.name,
      weightage: 0,
      isMandatory: true,
      scoreType: 'ThreatExposure',
      isSystem: true,
      sortOrder: f.sortOrder,
    })),
  ];

  await prisma.tPRMScorecardFactor.createMany({
    data: allFactors,
    skipDuplicates: true,
  });
}
