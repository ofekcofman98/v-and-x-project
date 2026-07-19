/**
 * Query key factory for TanStack Query.
 * All query keys must be defined here to maintain consistency
 * and avoid cache collisions.
 */

export const queryKeys = {
  tables: {
    all: ['tables'] as const,
    detail: (id: string) => ['tables', id] as const,
  },
  baseLists: {
    all: ['baseLists'] as const,
    detail: (id: string) => ['baseLists', id] as const,
  },
  columnTemplates: {
    all: ['columnTemplates'] as const,
    detail: (id: string) => ['columnTemplates', id] as const,
  },
} as const;
