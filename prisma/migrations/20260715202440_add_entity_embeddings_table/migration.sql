-- CreateTable
CREATE TABLE "entity_embeddings" (
    "table_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "dim" INTEGER NOT NULL,
    "labels" TEXT[],
    "vectors" BYTEA NOT NULL,
    "labels_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_embeddings_pkey" PRIMARY KEY ("table_id")
);

-- AddForeignKey
ALTER TABLE "entity_embeddings" ADD CONSTRAINT "entity_embeddings_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
