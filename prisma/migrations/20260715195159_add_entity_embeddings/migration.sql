-- CreateTable
CREATE TABLE "column_templates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "schema" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "column_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_list_templates" (
    "id" UUID NOT NULL,
    "base_list_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "auto_sync" BOOLEAN NOT NULL DEFAULT false,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "base_list_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "column_templates_user_id_idx" ON "column_templates"("user_id");

-- CreateIndex
CREATE INDEX "column_templates_organization_id_idx" ON "column_templates"("organization_id");

-- CreateIndex
CREATE INDEX "column_templates_category_idx" ON "column_templates"("category");

-- CreateIndex
CREATE INDEX "column_templates_is_public_idx" ON "column_templates"("is_public");

-- CreateIndex
CREATE INDEX "base_list_templates_base_list_id_idx" ON "base_list_templates"("base_list_id");

-- CreateIndex
CREATE INDEX "base_list_templates_template_id_idx" ON "base_list_templates"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "base_list_templates_base_list_id_template_id_key" ON "base_list_templates"("base_list_id", "template_id");

-- AddForeignKey
ALTER TABLE "base_list_templates" ADD CONSTRAINT "base_list_templates_base_list_id_fkey" FOREIGN KEY ("base_list_id") REFERENCES "base_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "base_list_templates" ADD CONSTRAINT "base_list_templates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "column_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
