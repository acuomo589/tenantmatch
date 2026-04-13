-- LLM-first listing text modeling
-- 1) Introduce source enum for text-origin metadata
-- 2) Add ListingDisclosure table
-- 3) Make ListingFeature more text-first / optional-key

CREATE TYPE "ListingTextSource" AS ENUM ('UPLOAD', 'SEARCH', 'PARSED');

ALTER TABLE "listing_features"
  ALTER COLUMN "feature_key" DROP NOT NULL,
  ADD COLUMN "source_text" TEXT,
  ADD COLUMN "tags_json" JSONB,
  ADD COLUMN "confidence" DECIMAL(5,4);

CREATE TABLE "listing_disclosures" (
  "id" UUID NOT NULL,
  "listing_id" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "source_text" TEXT,
  "source" "ListingTextSource",
  "is_material" BOOLEAN DEFAULT true,
  "tags_json" JSONB,
  "confidence" DECIMAL(5,4),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "listing_disclosures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "listing_disclosures_listing_id_fkey" FOREIGN KEY ("listing_id")
    REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "listing_disclosures_listing_id_idx" ON "listing_disclosures"("listing_id");
