import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Workpaper shape returned to the client (AI workpaper list / add) */
interface WorkpaperItem {
  id: string;
  task: string;
  steps: string;
  evidences: string;
  questionChecklist: string;
  comments: string;
  executed: boolean;
}

/**
 * Map RunPod /api/generate-audit-plan response to workpapers.
 * Supports: audit_tasks (array), tasks, or workpapers; nested in audit_plan or root.
 */
function mapResponseToWorkpapers(data: unknown): WorkpaperItem[] {
  const ts = Date.now();
  const out: WorkpaperItem[] = [];

  const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

  // Flatten: audit_plan[].audit_tasks or single audit_plan.audit_tasks
  let tasks: unknown[] = [];
  const root = data as Record<string, unknown>;
  if (Array.isArray(root.audit_plan)) {
    for (const plan of root.audit_plan) {
      const p = plan as Record<string, unknown>;
      tasks = tasks.concat(asArr(p.audit_tasks));
    }
  } else if (root.audit_plan && typeof root.audit_plan === 'object') {
    tasks = asArr((root.audit_plan as Record<string, unknown>).audit_tasks);
  }
  if (tasks.length === 0) {
    tasks = asArr(root.audit_tasks).length ? asArr(root.audit_tasks) : asArr(root.tasks);
  }
  if (tasks.length === 0 && Array.isArray(root.workpapers)) {
    return (root.workpapers as WorkpaperItem[]).map((wp, i) => ({
      ...wp,
      id: wp.id || `gen-${ts}-${i + 1}`,
      executed: wp.executed ?? false,
    }));
  }

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i] as Record<string, unknown>;
    const taskName =
      typeof t.task_name === 'string'
        ? t.task_name
        : typeof t.task === 'string'
          ? t.task
          : `Task ${i + 1}`;
    const stepsArr = Array.isArray(t.audit_steps)
      ? (t.audit_steps as string[]).filter(Boolean)
      : Array.isArray(t.methodology)
        ? (t.methodology as { code?: string; step?: string }[])
            .map((m) => (typeof m === 'string' ? m : m?.step))
            .filter((s): s is string => typeof s === 'string' && s.length > 0)
        : typeof t.steps === 'string'
          ? t.steps.split('\n').filter(Boolean)
          : [];
    const steps = stepsArr.join('\n') || '';
    const evidencesArr = Array.isArray(t.evidence_to_collect)
      ? (t.evidence_to_collect as string[]).filter(Boolean)
      : Array.isArray(t.evidences)
        ? (t.evidences as { code?: string; item?: string }[])
            .map((e) => (typeof e === 'string' ? e : e?.item))
            .filter((s): s is string => typeof s === 'string' && s.length > 0)
        : typeof t.evidences === 'string'
          ? t.evidences.split('\n').filter(Boolean)
          : [];
    const evidences = evidencesArr.join('\n') || '';
    const questionsArr = Array.isArray(t.audit_checklist_questions)
      ? (t.audit_checklist_questions as string[]).filter(Boolean)
      : [];
    const questionChecklist = questionsArr.join('\n') || '';

    out.push({
      id: `gen-${ts}-${i + 1}`,
      task: taskName,
      steps,
      evidences,
      questionChecklist,
      comments: '',
      executed: false,
    });
  }

  return out;
}

/**
 * POST /api/internal-audit/fieldwork/[id]/ai-workpapers/generate
 * Proxies to RunPod POST /api/generate-audit-plan to generate AI workpapers for the engagement.
 */
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

      // Get target language from request body or cookie (defaults to 'en')
      let targetLanguage = 'en';
      try {
        const body = await req.json();
        targetLanguage = body.target_language || req.cookies.get('NEXT_LOCALE')?.value || 'en';
      } catch {
        targetLanguage = req.cookies.get('NEXT_LOCALE')?.value || 'en';
      }

      const engagement = await prisma.auditEngagement.findUnique({
        where: { id: engagementId },
        include: { department: true },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: 'Server misconfiguration: missing API secret' },
          { status: 500 }
        );
      }

      const engagementTitle = engagement.engagementTitle || 'Audit engagement';
      const engagementObjective = (engagement.engagementObjective?.trim() || 'Assess controls and compliance for this engagement');
      const engagementScope = (engagement.engagementScope?.trim() || 'Full scope of the engagement');

      const form = new FormData();
      form.append('engagement_title', engagementTitle);
      form.append('engagement_objective', engagementObjective);
      form.append('engagement_scope', engagementScope);
      form.append('target_language', targetLanguage);

      const url = getExternalApiUrl('PYTHON_BACKEND', '/api/generate-audit-plan');
      console.log('[RunPod generate-audit-plan] POST /api/internal-audit/fieldwork/[id]/ai-workpapers/generate received');
      console.log('[RunPod generate-audit-plan] Request engagementId=' + engagementId + ', engagement_title=' + engagementTitle + ', objective=' + (engagementObjective || '(empty)') + ', scope=' + (engagementScope || '(empty)'));
      console.log('[RunPod generate-audit-plan] Target language:', targetLanguage);
      console.log('[RunPod generate-audit-plan] Calling RunPod POST ' + url);

      const res = await fetch(url, {
        method: 'POST',
        headers: { auth: secret },
        body: form,
      });

      const resText = await res.text();
      console.log('[RunPod generate-audit-plan] RunPod response status: ' + res.status);
      console.log('[RunPod generate-audit-plan] RunPod response body: ' + resText);

      if (!res.ok) {
        console.log('[RunPod generate-audit-plan] RunPod call failed, returning error to client');
        let errBody: { error?: string; detail?: unknown } = {
          error: 'AI workpaper generation failed',
        };
        try {
          const j = JSON.parse(resText);
          if (j.detail) errBody.detail = j.detail;
          else if (j.error) errBody.error = j.error;
        } catch {
          errBody.error = resText || errBody.error;
        }
        return NextResponse.json(errBody, { status: res.status });
      }

      let data: unknown;
      try {
        data = JSON.parse(resText);
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from RunPod' },
          { status: 502 }
        );
      }

      const workpapers = mapResponseToWorkpapers(data);
      console.log('[RunPod generate-audit-plan] Success, mapped ' + workpapers.length + ' workpaper(s) to client');

      return NextResponse.json({
        workpapers,
        message: 'AI workpapers generated successfully',
      });
    } catch (error) {
      console.error('[RunPod generate-audit-plan] Error:', error);
      console.error('[RunPod generate-audit-plan] Stack:', (error as Error)?.stack);
      return NextResponse.json(
        { error: 'Failed to generate AI workpapers' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);
