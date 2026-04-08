-- CreateEnum
CREATE TYPE "column_type" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "entry_source" AS ENUM ('VOICE', 'MANUAL', 'IMPORT');

-- CreateTable
CREATE TABLE "base_lists" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schema" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "base_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_entities" (
    "id" UUID NOT NULL,
    "base_list_id" UUID NOT NULL,
    "values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tables" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_list_id" UUID,
    "representative_column_key" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_columns" (
    "id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "column_type" NOT NULL DEFAULT 'TEXT',
    "order" INTEGER NOT NULL DEFAULT 0,
    "validation" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_cells" (
    "id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "table_column_id" UUID NOT NULL,
    "entity_id" UUID,
    "row_key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "entry_source" "entry_source" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_cells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "list_entities_base_list_id_idx" ON "list_entities"("base_list_id");

-- CreateIndex
CREATE INDEX "tables_base_list_id_idx" ON "tables"("base_list_id");

-- CreateIndex
CREATE INDEX "table_columns_table_id_order_idx" ON "table_columns"("table_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "table_columns_table_id_key_key" ON "table_columns"("table_id", "key");

-- CreateIndex
CREATE INDEX "table_cells_table_id_row_key_idx" ON "table_cells"("table_id", "row_key");

-- CreateIndex
CREATE INDEX "table_cells_table_id_table_column_id_idx" ON "table_cells"("table_id", "table_column_id");

-- CreateIndex
CREATE INDEX "table_cells_entity_id_idx" ON "table_cells"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "table_cells_table_id_row_key_table_column_id_key" ON "table_cells"("table_id", "row_key", "table_column_id");

-- AddForeignKey
ALTER TABLE "list_entities" ADD CONSTRAINT "list_entities_base_list_id_fkey" FOREIGN KEY ("base_list_id") REFERENCES "base_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_base_list_id_fkey" FOREIGN KEY ("base_list_id") REFERENCES "base_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_columns" ADD CONSTRAINT "table_columns_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_cells" ADD CONSTRAINT "table_cells_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_cells" ADD CONSTRAINT "table_cells_table_column_id_fkey" FOREIGN KEY ("table_column_id") REFERENCES "table_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_cells" ADD CONSTRAINT "table_cells_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "list_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
