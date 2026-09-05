-- AlterTable
ALTER TABLE "voice_interactions" ADD COLUMN     "navigation_mode" TEXT,
ADD COLUMN     "targets" JSONB,
ADD COLUMN     "was_batch" BOOLEAN;
