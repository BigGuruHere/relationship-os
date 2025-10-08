/*
  Warnings:

  - You are about to drop the column `vec` on the `InteractionEmbedding` table. All the data in the column will be lost.
  - You are about to drop the column `embedding_vec` on the `Tag` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."interaction_vec_hnsw";

-- DropIndex
DROP INDEX "public"."tag_vec_hnsw";

-- AlterTable
ALTER TABLE "public"."InteractionEmbedding" DROP COLUMN "vec";

-- AlterTable
ALTER TABLE "public"."Tag" DROP COLUMN "embedding_vec";

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "passwordHash" DROP NOT NULL;
