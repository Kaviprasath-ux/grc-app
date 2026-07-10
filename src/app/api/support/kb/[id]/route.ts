import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-auth';
import { generateEmbedding } from '@/lib/chatbot/kb-embeddings';

type Session = AuthenticatedRequest['user'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MODULES = ['general', 'compliance', 'risk-management', 'asset-management', 'internal-audit', 'tprm', 'organization'];
const SCOPES = ['both', 'grc', 'audit', 'tprm'];

// ==================== PATCH (edit + re-embed) ====================
export const PATCH = withAuth(
  async (req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const existing = await prisma.chatbotKBArticle.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = { updatedById: session.id };

    const question = typeof body.question === 'string' ? body.question.trim() : existing.question;
    const answer = typeof body.answer === 'string' ? body.answer.trim() : (existing.answer ?? '');

    if (typeof body.question === 'string') data.question = question;
    if (typeof body.answer === 'string') data.answer = answer;
    if (MODULES.includes(body.module)) data.module = body.module;
    if (SCOPES.includes(body.productScope)) data.productScope = body.productScope;
    if (typeof body.category === 'string') data.category = body.category;
    if (Array.isArray(body.roles)) data.roles = body.roles.filter((r: unknown) => typeof r === 'string');
    if (typeof body.isPublished === 'boolean') data.isPublished = body.isPublished;

    // Re-embed if the question or answer text changed.
    if (typeof body.question === 'string' || typeof body.answer === 'string') {
      const content = `${question}\n\n${answer}`;
      data.content = content;
      data.embedding = await generateEmbedding(content);
    }

    const article = await prisma.chatbotKBArticle.update({ where: { id }, data });
    return NextResponse.json({ id: article.id });
  },
  { resource: 'support.kb', action: 'edit' },
);

// ==================== DELETE ====================
export const DELETE = withAuth(
  async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const existing = await prisma.chatbotKBArticle.findUnique({ where: { id }, select: { id: true, source: true } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Only allow deleting manually-authored articles; seeded ones are managed by code.
    if (existing.source !== 'manual') {
      return NextResponse.json({ error: 'Seeded articles cannot be deleted here' }, { status: 400 });
    }
    await prisma.chatbotKBArticle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  },
  { resource: 'support.kb', action: 'delete' },
);
