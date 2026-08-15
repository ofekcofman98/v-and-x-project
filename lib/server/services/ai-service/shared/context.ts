/**
 * AI Context Resolver ("RAG on a Diet")
 *
 * Resolves `@Mention` references to the minimal BaseList metadata needed for
 * LLM prompt context — name, column definitions, and an entity COUNT — never
 * the full entity list. Implements: docs/features/03_ai_table_agent.md §2.3.
 *
 * Deliberately uses `select` (not `include`) so this never pulls the full
 * ListEntity table into memory just to describe a schema to the model.
 *
 * Shared across all three AI Agent pillars (Schema Agent, Grid Agent, Batch
 * Voice Parser) — not specific to schema drafting.
 */

import { prisma } from '@/lib/prisma';
import { ownershipWhere } from '@/lib/server/services/auth';
import type { Mention } from '@/lib/shared/types/ai';
import type { BaseListColumn } from '@/lib/shared/types/models';

export interface MentionContext {
  mention: Mention;
  baseListId: string;
  name: string;
  columns: Pick<BaseListColumn, 'id' | 'label' | 'type'>[];
  entityCount: number;
}

/**
 * Resolves `@Mention` references to minimal, ownership-checked BaseList
 * metadata for LLM prompt context.
 *
 * @throws Error if any mention is unresolvable or not owned by the user.
 */
export async function resolveMentionContext(
  userId: string,
  organizationIds: string[],
  mentions: Mention[]
): Promise<MentionContext[]> {
  return Promise.all(mentions.map((mention) => resolveOne(userId, organizationIds, mention)));
}

async function resolveOne(
  userId: string,
  organizationIds: string[],
  mention: Mention
): Promise<MentionContext> {
  // mention.type is currently always 'baseList' (MentionSchema literal) — the
  // switch is kept for forward-compat with future mention types per the doc.
  switch (mention.type) {
    case 'baseList': {
      const [baseList, entityCount] = await Promise.all([
        prisma.baseList.findFirst({
          where: { id: mention.id, ...ownershipWhere(userId, organizationIds) },
          select: { id: true, name: true, schema: true },
        }),
        prisma.listEntity.count({ where: { baseListId: mention.id } }),
      ]);

      if (!baseList) throw new Error('BaseList not found');

      const schema = baseList.schema as unknown as { columns: BaseListColumn[] };

      return {
        mention,
        baseListId: baseList.id,
        name: baseList.name,
        columns: schema.columns.map(({ id, label, type }) => ({ id, label, type })),
        entityCount,
      };
    }
  }
}
