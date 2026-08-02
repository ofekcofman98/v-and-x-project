-- AlterEnum
ALTER TYPE "column_type" ADD VALUE 'COMPUTED';

-- AlterTable
ALTER TABLE "table_columns" ADD COLUMN "formula" JSONB;
