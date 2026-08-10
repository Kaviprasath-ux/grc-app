import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getTenantFilter } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tprm/asr-assessments/[id] — Get assessment detail for assessor
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });
      console.log(`[ASR] GET /asr-assessments/${id} — user=${session.email}`);

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, ...tenantFilter },
        include: {
          vendor: {
            select: {
              id: true, name: true, vendorCode: true, accountManagerEmail: true,
              monitoringVendor: {
                select: {
                  id: true,
                  assessments: {
                    where: { isLatest: true },
                    take: 1,
                    select: {
                      overallScore: true,
                      securityPostureScore: true,
                      threatExposureScore: true,
                      calculatedOverallScore: true,
                      calculatedSecurityPosture: true,
                      calculatedThreatExposure: true,
                    },
                  },
                },
              },
            },
          },
          initiatedBy: { select: { id: true, fullName: true } },
          assessor: { select: { id: true, fullName: true } },
          approver: { select: { id: true, fullName: true } },
          // No `take` cap: activity logs are the audit trail of the
          // assessment and must remain available for the lifetime of
          // the assessment. Capping at 100 silently dropped the oldest
          // entries (initiation, AM assignment, early submissions) the
          // moment a busy assessment crossed that threshold.
          logs: { orderBy: { logDate: 'desc' } },
          responses: { orderBy: { questionNo: 'asc' } },
        },
      });

      if (!assessment) {
        console.warn(`[ASR] GET /asr-assessments/${id} — 404 not found for user=${session.email}`);
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Load questionnaire questions
      let questions: unknown[] = [];
      if (assessment.questionnaireTemplate) {
        // questionnaireTemplate may hold several comma-separated template names
        // (the initiation UI joins multi-selected templates with ", "), so match
        // every one of them and aggregate their questions, de-duplicated by id.
        const templateNames = assessment.questionnaireTemplate
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        const templates = await prisma.tPRMQuestionnaireTemplate.findMany({
          where: { customerAccountId: assessment.customerAccountId, templateName: { in: templateNames } },
          include: {
            masterQuestionLinks: {
              include: {
                question: {
                  include: {
                    domain: { select: { id: true, name: true } },
                    children: { orderBy: { sortOrder: 'asc' } },
                  },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        });

        const seenQuestionIds = new Set<string>();
        questions = templates
          .flatMap(t => t.masterQuestionLinks)
          .filter(link => {
            if (seenQuestionIds.has(link.question.id)) return false;
            seenQuestionIds.add(link.question.id);
            return true;
          })
          .map(link => ({
            id: link.question.id,
            questionText: link.question.questionText,
            domainId: link.question.domainId,
            domainName: link.question.domain?.name || '',
            isParentQuestion: link.question.isParentQuestion,
            parentId: link.question.parentId,
            mandatoryAttachment: link.question.mandatoryAttachment,
            mandatoryQuestion: link.question.mandatoryQuestion,
            validateThroughAI: link.question.validateThroughAI,
            verifaiPrompt: link.question.verifaiPrompt,
            issue: link.question.issue,
            risk: link.question.risk,
            recommendation: link.question.recommendation,
            severity: link.question.severity,
            sortOrder: link.sortOrder,
            children: link.question.children.map(c => ({
              id: c.id,
              questionText: c.questionText,
              mandatoryAttachment: c.mandatoryAttachment,
              mandatoryQuestion: c.mandatoryQuestion,
              validateThroughAI: c.validateThroughAI,
              sortOrder: c.sortOrder,
            })),
          }));
      }

      // Load ONLY the domains referenced by this assessment's questions —
      // previously the route loaded every active domain in the tenant,
      // which leaked unrelated domains into the assessor's domain filter
      // (e.g. when only the "Default" questionnaire was selected, all the
      // tenant's other questionnaires' domains still appeared). Filtering
      // by ids actually present on the question set keeps the dropdown
      // honest. Symmetric with the AM-side route.
      const usedDomainIds = Array.from(
        new Set(
          (questions as Array<{ domainId: string | null }>)
            .map((q) => q.domainId)
            .filter((id): id is string => Boolean(id))
        )
      );
      const domains = usedDomainIds.length === 0
        ? []
        : await prisma.tPRMDomain.findMany({
            where: { customerAccountId: assessment.customerAccountId, isActive: true, id: { in: usedDomainIds } },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true },
          });

      // Compute summary stats from responses
      const resps = assessment.responses;
      const yesCount = resps.filter(r => r.response === 'Yes').length;
      const noCount = resps.filter(r => r.response === 'No').length;
      const naCount = resps.filter(r => r.response === 'NA').length;
      const satisfactoryCount = resps.filter(r => (r.assessorStatus || r.poStatus || '').toLowerCase() === 'satisfactory').length;
      const unsatisfactoryCount = resps.filter(r => (r.assessorStatus || r.poStatus || '').toLowerCase() === 'unsatisfactory').length;
      // Severity counts describe FINDINGS, so they must be scoped the same way
      // the VerifAI Summary table and the Assessment Report are: answered
      // questions whose effective status is Unsatisfactory. Previously these
      // counted every response carrying a severity — and the AI writes
      // `poSeverity` on Satisfactory verdicts too — so the High/Medium/Low
      // strip reported more findings than the table below it listed. Matches
      // the "only count if the status is Unsatisfactory (an actual issue)"
      // rule already used by the rm-/bo-/it-issues registers.
      const findings = resps.filter(r =>
        Boolean(r.response) &&
        (r.assessorStatus || r.poStatus || '').toLowerCase() === 'unsatisfactory'
      );
      const severityOf = (r: typeof resps[number]) =>
        (r.assessorSeverity || r.poSeverity || '').toLowerCase();
      // The AI backend and manual assessor overrides use multiple
      // vocabularies for severity — assessment finding words
      // (High/Medium/Low), VRR words (Critical/Moderate/Nominal), and
      // sometimes both mixed. Fold into three display buckets so a
      // finding with severity "Moderate" shows up in Medium instead
      // of silently disappearing from the count while still rendering
      // in the table below.
      //
      // Matches the bucketOf logic in src/app/api/tprm/asr-dashboard/route.ts.
      const bucketOf = (r: typeof resps[number]): 'high' | 'medium' | 'low' | null => {
        const s = severityOf(r);
        if (s === 'critical' || s === 'high') return 'high';
        if (s === 'moderate' || s === 'medium') return 'medium';
        if (s === 'nominal' || s === 'low') return 'low';
        return null;
      };
      const highCount = findings.filter(r => bucketOf(r) === 'high').length;
      const mediumCount = findings.filter(r => bucketOf(r) === 'medium').length;
      const lowCount = findings.filter(r => bucketOf(r) === 'low').length;

      const summary = {
        yesCount, noCount, naCount,
        satisfactoryCount, unsatisfactoryCount,
        highCount, mediumCount, lowCount,
        totalResponses: resps.length,
      };

      // Extract monitoring scores from vendor's linked monitoring data
      const latestMonitoring = (assessment.vendor as Record<string, unknown> & { monitoringVendor?: { assessments?: Record<string, unknown>[] } })?.monitoringVendor?.assessments?.[0];
      const monitoringScores = latestMonitoring ? {
        overallScore: latestMonitoring.calculatedOverallScore ?? latestMonitoring.overallScore ?? null,
        securityPostureScore: latestMonitoring.calculatedSecurityPosture ?? latestMonitoring.securityPostureScore ?? null,
        threatExposureScore: latestMonitoring.calculatedThreatExposure ?? latestMonitoring.threatExposureScore ?? null,
      } : null;

      console.log(`[ASR] GET /asr-assessments/${id} — OK, code=${assessment.assessmentCode} vendor=${assessment.vendor?.name} responses=${resps.length} satisfactory=${satisfactoryCount} unsatisfactory=${unsatisfactoryCount} questions=${questions.length} monitoring=${!!monitoringScores}`);
      return NextResponse.json({ assessment, questions, domains, summary, monitoringScores });
    } catch (error) {
      console.error(`[ASR] GET /asr-assessments — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to fetch assessment' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'view' }
);
