-- Simplify TenantMatch to the address/workbook/link data model.
-- Keep:
--   app_users, tenants, tenant_memberships, plans, tenant_subscriptions,
--   usage_counters, workspace_states, lite_workbooks, lite_links
-- Drop legacy prototype tables and enums that are no longer referenced.

DROP TABLE IF EXISTS "public_report_purchases" CASCADE;
DROP TABLE IF EXISTS "public_reports" CASCADE;
DROP TABLE IF EXISTS "messages" CASCADE;
DROP TABLE IF EXISTS "runs" CASCADE;
DROP TABLE IF EXISTS "threads" CASCADE;
DROP TABLE IF EXISTS "listing_market_snapshots" CASCADE;
DROP TABLE IF EXISTS "listing_tenants" CASCADE;
DROP TABLE IF EXISTS "listing_contacts" CASCADE;
DROP TABLE IF EXISTS "listing_disclosures" CASCADE;
DROP TABLE IF EXISTS "listing_features" CASCADE;
DROP TABLE IF EXISTS "listing_spaces" CASCADE;
DROP TABLE IF EXISTS "listing_assets" CASCADE;
DROP TABLE IF EXISTS "listings" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;

DROP TYPE IF EXISTS "PublicReportPurchaseStatus";
DROP TYPE IF EXISTS "PublicReportStatus";
DROP TYPE IF EXISTS "MessageRole";
DROP TYPE IF EXISTS "RunStatus";
DROP TYPE IF EXISTS "ListingContactRole";
DROP TYPE IF EXISTS "ListingLifecycleStatus";
DROP TYPE IF EXISTS "ListingSource";
DROP TYPE IF EXISTS "ListingTextSource";
DROP TYPE IF EXISTS "ListingType";
