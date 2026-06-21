-- CreateEnum
CREATE TYPE "LiteLinkStatus" AS ENUM ('GENERATED', 'OPENED', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "lite_workbooks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "input_address" TEXT NOT NULL,
    "normalized_address" TEXT NOT NULL,
    "display_address" TEXT NOT NULL,
    "workbook_csv" TEXT NOT NULL,
    "workbook_rows_json" JSONB NOT NULL,
    "preview_row_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lite_workbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lite_links" (
    "id" UUID NOT NULL,
    "workbook_id" UUID NOT NULL,
    "buyer_email" TEXT NOT NULL,
    "buyer_name" TEXT,
    "token" TEXT NOT NULL,
    "status" "LiteLinkStatus" NOT NULL DEFAULT 'GENERATED',
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "stripe_checkout_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "purchaser_email" TEXT,
    "purchaser_name" TEXT,
    "amount_paid_cents" INTEGER,
    "opened_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lite_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lite_workbooks_tenant_id_normalized_address_key" ON "lite_workbooks"("tenant_id", "normalized_address");

-- CreateIndex
CREATE INDEX "lite_workbooks_tenant_id_updated_at_idx" ON "lite_workbooks"("tenant_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "lite_links_token_key" ON "lite_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "lite_links_stripe_checkout_session_id_key" ON "lite_links"("stripe_checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "lite_links_stripe_payment_intent_id_key" ON "lite_links"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "lite_links_workbook_id_buyer_email_key" ON "lite_links"("workbook_id", "buyer_email");

-- CreateIndex
CREATE INDEX "lite_links_status_updated_at_idx" ON "lite_links"("status", "updated_at");

-- CreateIndex
CREATE INDEX "lite_links_buyer_email_updated_at_idx" ON "lite_links"("buyer_email", "updated_at");

-- AddForeignKey
ALTER TABLE "lite_workbooks" ADD CONSTRAINT "lite_workbooks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lite_links" ADD CONSTRAINT "lite_links_workbook_id_fkey" FOREIGN KEY ("workbook_id") REFERENCES "lite_workbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
