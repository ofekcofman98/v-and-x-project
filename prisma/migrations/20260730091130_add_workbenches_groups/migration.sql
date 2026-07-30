-- CreateTable
CREATE TABLE "workbenches" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workbenches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "workbench_id" UUID NOT NULL,
    "parent_group_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_base_lists" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "base_list_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_base_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workbench_members" (
    "id" UUID NOT NULL,
    "workbench_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "org_role" NOT NULL DEFAULT 'VIEWER',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workbench_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "org_role" NOT NULL DEFAULT 'VIEWER',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workbenches_user_id_idx" ON "workbenches"("user_id");

-- CreateIndex
CREATE INDEX "workbenches_organization_id_idx" ON "workbenches"("organization_id");

-- CreateIndex
CREATE INDEX "groups_workbench_id_idx" ON "groups"("workbench_id");

-- CreateIndex
CREATE INDEX "groups_parent_group_id_idx" ON "groups"("parent_group_id");

-- CreateIndex
CREATE INDEX "group_base_lists_group_id_idx" ON "group_base_lists"("group_id");

-- CreateIndex
CREATE INDEX "group_base_lists_base_list_id_idx" ON "group_base_lists"("base_list_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_base_lists_group_id_base_list_id_key" ON "group_base_lists"("group_id", "base_list_id");

-- CreateIndex
CREATE INDEX "workbench_members_workbench_id_idx" ON "workbench_members"("workbench_id");

-- CreateIndex
CREATE INDEX "workbench_members_user_id_idx" ON "workbench_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workbench_members_workbench_id_user_id_key" ON "workbench_members"("workbench_id", "user_id");

-- CreateIndex
CREATE INDEX "group_members_group_id_idx" ON "group_members"("group_id");

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_workbench_id_fkey" FOREIGN KEY ("workbench_id") REFERENCES "workbenches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_group_id_fkey" FOREIGN KEY ("parent_group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_base_lists" ADD CONSTRAINT "group_base_lists_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_base_lists" ADD CONSTRAINT "group_base_lists_base_list_id_fkey" FOREIGN KEY ("base_list_id") REFERENCES "base_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workbench_members" ADD CONSTRAINT "workbench_members_workbench_id_fkey" FOREIGN KEY ("workbench_id") REFERENCES "workbenches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

