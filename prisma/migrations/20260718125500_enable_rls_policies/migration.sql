-- Row Level Security for Phase 1 multi-tenant tables.
-- Defense-in-depth only: Prisma connects via a direct/service-role connection
-- that bypasses RLS. These policies protect any direct Supabase-client access
-- (e.g. Realtime subscriptions). Primary tenant enforcement lives in
-- lib/server/services/auth.ts (ownershipWhere) used by every API route.

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "base_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;

-- organizations: members can view; only the owner can update/delete
CREATE POLICY "Members can view their organizations"
  ON "organizations" FOR SELECT
  USING (
    "owner_id" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "organization_members"
      WHERE "organization_members"."organization_id" = "organizations"."id"
        AND "organization_members"."user_id" = auth.uid()
    )
  );

CREATE POLICY "Owners can update their organizations"
  ON "organizations" FOR UPDATE
  USING ("owner_id" = auth.uid());

CREATE POLICY "Owners can delete their organizations"
  ON "organizations" FOR DELETE
  USING ("owner_id" = auth.uid());

CREATE POLICY "Authenticated users can create organizations"
  ON "organizations" FOR INSERT
  WITH CHECK ("owner_id" = auth.uid());

-- organization_members: users can view their own memberships, or all
-- memberships in orgs where they are owner/admin
CREATE POLICY "Users can view their memberships"
  ON "organization_members" FOR SELECT
  USING (
    "user_id" = auth.uid()
    OR "organization_id" IN (
      SELECT "organization_id" FROM "organization_members"
      WHERE "user_id" = auth.uid() AND "role" IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Admins can add members"
  ON "organization_members" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "organization_members" om
      WHERE om."organization_id" = "organization_members"."organization_id"
        AND om."user_id" = auth.uid()
        AND om."role" IN ('OWNER', 'ADMIN')
    )
  );

-- base_lists: owner or org member can view/edit/delete
CREATE POLICY "Users view own or org base_lists"
  ON "base_lists" FOR SELECT
  USING (
    "user_id" = auth.uid()
    OR ("organization_id" IS NOT NULL AND "organization_id" IN (
      SELECT "organization_id" FROM "organization_members" WHERE "user_id" = auth.uid()
    ))
  );

CREATE POLICY "Users modify own or org base_lists"
  ON "base_lists" FOR UPDATE
  USING (
    "user_id" = auth.uid()
    OR ("organization_id" IS NOT NULL AND "organization_id" IN (
      SELECT "organization_id" FROM "organization_members" WHERE "user_id" = auth.uid()
    ))
  );

CREATE POLICY "Users delete own base_lists"
  ON "base_lists" FOR DELETE
  USING ("user_id" = auth.uid());

CREATE POLICY "Users create own base_lists"
  ON "base_lists" FOR INSERT
  WITH CHECK ("user_id" = auth.uid());

-- tables: owner or org member can view/edit/delete
CREATE POLICY "Users view own or org tables"
  ON "tables" FOR SELECT
  USING (
    "user_id" = auth.uid()
    OR ("organization_id" IS NOT NULL AND "organization_id" IN (
      SELECT "organization_id" FROM "organization_members" WHERE "user_id" = auth.uid()
    ))
  );

CREATE POLICY "Users modify own or org tables"
  ON "tables" FOR UPDATE
  USING (
    "user_id" = auth.uid()
    OR ("organization_id" IS NOT NULL AND "organization_id" IN (
      SELECT "organization_id" FROM "organization_members" WHERE "user_id" = auth.uid()
    ))
  );

CREATE POLICY "Users delete own tables"
  ON "tables" FOR DELETE
  USING ("user_id" = auth.uid());

CREATE POLICY "Users create own tables"
  ON "tables" FOR INSERT
  WITH CHECK ("user_id" = auth.uid());
