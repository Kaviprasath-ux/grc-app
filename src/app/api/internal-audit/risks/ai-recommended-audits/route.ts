import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';

interface RecommendedAudit {
  id: string;
  auditName: string;
  department: string;
  riskLevel: string;
  justification: string;
  suggestedScope: string;
  relatedRisks: string[];
  priority: 'High' | 'Medium' | 'Low';
  estimatedDuration: string;
}

// GET /api/internal-audit/risks/ai-recommended-audits - Get AI recommended audits based on risks
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // Get all risks with their details
      const risks = await prisma.internalAuditRisk.findMany({
        where: {
          ...tenantFilter,
          ...auditHeadFilter,
        },
        include: {
          department: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get existing audit engagements to avoid duplicate recommendations
      const existingEngagements = await prisma.auditEngagement.findMany({
        where: {
          ...tenantFilter,
          ...auditHeadFilter,
        },
        select: {
          departmentId: true,
          engagementTitle: true,
          status: true,
        },
      });

      // Group risks by department and risk level
      const risksByDepartment: Record<string, typeof risks> = {};
      risks.forEach(risk => {
        const deptName = risk.department?.name || 'Unassigned';
        if (!risksByDepartment[deptName]) {
          risksByDepartment[deptName] = [];
        }
        risksByDepartment[deptName].push(risk);
      });

      // Generate AI recommendations based on risk analysis
      const recommendations: RecommendedAudit[] = [];
      let recommendationId = 1;

      for (const [deptName, deptRisks] of Object.entries(risksByDepartment)) {
        // Count risks by level
        const extremeRisks = deptRisks.filter(r => r.riskLevel?.toLowerCase() === 'extreme' || r.riskLevel?.toLowerCase() === 'critical');
        const highRisks = deptRisks.filter(r => r.riskLevel?.toLowerCase() === 'high');
        const mediumRisks = deptRisks.filter(r => r.riskLevel?.toLowerCase() === 'medium' || r.riskLevel?.toLowerCase() === 'moderate');

        // Check if department already has ongoing audit
        const hasOngoingAudit = existingEngagements.some(
          e => e.departmentId === deptRisks[0]?.departmentId &&
               ['In Progress', 'Ongoing', 'Active'].includes(e.status || '')
        );

        // Recommend audit for departments with extreme/high risks
        if (extremeRisks.length > 0 || highRisks.length >= 2) {
          const topRisks = [...extremeRisks, ...highRisks].slice(0, 3);

          recommendations.push({
            id: `REC-${String(recommendationId++).padStart(3, '0')}`,
            auditName: `${deptName} Risk-Based Audit`,
            department: deptName,
            riskLevel: extremeRisks.length > 0 ? 'Extreme' : 'High',
            justification: extremeRisks.length > 0
              ? `Department has ${extremeRisks.length} extreme risk(s) requiring immediate audit attention.`
              : `Department has ${highRisks.length} high-risk items that need comprehensive review.`,
            suggestedScope: generateScope(topRisks),
            relatedRisks: topRisks.map(r => r.riskId),
            priority: extremeRisks.length > 0 ? 'High' : 'Medium',
            estimatedDuration: extremeRisks.length > 0 ? '4-6 weeks' : '2-4 weeks',
          });
        }

        // Recommend focused audit for specific risk categories
        const categoryGroups: Record<string, typeof deptRisks> = {};
        deptRisks.forEach(risk => {
          const catName = risk.category?.name || 'General';
          if (!categoryGroups[catName]) {
            categoryGroups[catName] = [];
          }
          categoryGroups[catName].push(risk);
        });

        for (const [catName, catRisks] of Object.entries(categoryGroups)) {
          if (catRisks.length >= 3 && catName !== 'General') {
            const hasHighRisk = catRisks.some(r =>
              ['extreme', 'critical', 'high'].includes(r.riskLevel?.toLowerCase() || '')
            );

            if (hasHighRisk) {
              recommendations.push({
                id: `REC-${String(recommendationId++).padStart(3, '0')}`,
                auditName: `${catName} Process Review - ${deptName}`,
                department: deptName,
                riskLevel: 'High',
                justification: `Multiple risks (${catRisks.length}) identified in ${catName} category requiring focused review.`,
                suggestedScope: `Review of ${catName.toLowerCase()} processes, controls, and compliance in ${deptName}.`,
                relatedRisks: catRisks.slice(0, 5).map(r => r.riskId),
                priority: 'Medium',
                estimatedDuration: '2-3 weeks',
              });
            }
          }
        }

        // Recommend compliance audit if multiple medium risks exist
        if (mediumRisks.length >= 5 && !hasOngoingAudit) {
          recommendations.push({
            id: `REC-${String(recommendationId++).padStart(3, '0')}`,
            auditName: `${deptName} Compliance Review`,
            department: deptName,
            riskLevel: 'Medium',
            justification: `Department has ${mediumRisks.length} medium-level risks that warrant periodic compliance review.`,
            suggestedScope: `Comprehensive review of departmental controls, procedures, and compliance status.`,
            relatedRisks: mediumRisks.slice(0, 5).map(r => r.riskId),
            priority: 'Low',
            estimatedDuration: '1-2 weeks',
          });
        }
      }

      // Sort recommendations by priority
      const priorityOrder = { High: 1, Medium: 2, Low: 3 };
      recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      return NextResponse.json({
        recommendations: recommendations.slice(0, 10), // Limit to top 10
        summary: {
          totalRisks: risks.length,
          extremeRisks: risks.filter(r => r.riskLevel?.toLowerCase() === 'extreme').length,
          highRisks: risks.filter(r => r.riskLevel?.toLowerCase() === 'high').length,
          departmentsAnalyzed: Object.keys(risksByDepartment).length,
          recommendationsGenerated: recommendations.length,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      return NextResponse.json(
        { error: 'Failed to generate audit recommendations' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'view' }
);

function generateScope(risks: Array<{ riskDescription: string | null; riskName: string | null; category: { name: string } | null }>) {
  const categories = [...new Set(risks.map(r => r.category?.name).filter(Boolean))];
  const riskAreas = risks.map(r => r.riskDescription || r.riskName).filter(Boolean).slice(0, 3);

  if (categories.length > 0) {
    return `Focus areas: ${categories.join(', ')}. Key risks to address: ${riskAreas.join('; ')}.`;
  }
  return `Review of identified risk areas: ${riskAreas.join('; ')}.`;
}
