/*
  Warnings:

  - Made the column `user_id` on table `base_lists` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user_id` on table `tables` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "base_lists" ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "tables" ALTER COLUMN "user_id" SET NOT NULL;
