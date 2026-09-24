-- CreateEnum
CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdCreativeType" AS ENUM ('IMAGE', 'RESPONSIVE_IMAGE', 'NATIVE_SPONSORED', 'VIDEO', 'HTML_RICH_MEDIA');

-- CreateEnum
CREATE TYPE "AdPlacementKey" AS ENUM ('BREAKING_NEWS_BELOW', 'TOP_BILLBOARD', 'MOBILE_STICKY', 'HOME_HERO', 'HOME_FEED', 'HOME_MID_FEED', 'HOME_SIDEBAR', 'HOME_BEFORE_FOOTER', 'ARTICLE_TOP', 'ARTICLE_AFTER_INTRO', 'ARTICLE_IN_CONTENT', 'ARTICLE_MID', 'ARTICLE_END', 'ARTICLE_RELATED', 'ARTICLE_SIDEBAR', 'CATEGORY_TOP', 'CATEGORY_FEED', 'CATEGORY_MID', 'CATEGORY_SIDEBAR', 'SEARCH_INLINE', 'PAGE_TOP', 'PAGE_CONTENT', 'PAGE_SIDEBAR', 'PAGE_BOTTOM');

-- CreateEnum
CREATE TYPE "AdPlacementGroup" AS ENUM ('GLOBAL', 'HOMEPAGE', 'ARTICLE', 'CATEGORY', 'SEARCH', 'GENERIC');

-- CreateEnum
CREATE TYPE "AdDeviceTarget" AS ENUM ('ALL', 'DESKTOP', 'TABLET', 'MOBILE');

-- CreateEnum
CREATE TYPE "AdPageTarget" AS ENUM ('ALL', 'HOMEPAGE', 'ARTICLE', 'CATEGORY', 'SEARCH', 'JOBS', 'VIDEO', 'SPECIAL');

-- CreateEnum
CREATE TYPE "AdEventType" AS ENUM ('IMPRESSION', 'CLICK');

-- CreateTable
CREATE TABLE "advertisers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_placements" (
    "id" TEXT NOT NULL,
    "key" "AdPlacementKey" NOT NULL,
    "label" TEXT NOT NULL,
    "group" "AdPlacementGroup" NOT NULL,
    "description" TEXT,
    "recommended_width" INTEGER,
    "recommended_height" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "target_url" TEXT,
    "language_id" TEXT,
    "device_target" "AdDeviceTarget" NOT NULL DEFAULT 'ALL',
    "page_target" "AdPageTarget" NOT NULL DEFAULT 'ALL',
    "category_id" TEXT,
    "location_id" TEXT,
    "frequency_cap_per_day" INTEGER,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_creatives" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "type" "AdCreativeType" NOT NULL,
    "desktop_media_id" TEXT,
    "mobile_media_id" TEXT,
    "target_url" TEXT,
    "cta_text" TEXT,
    "alt_text" TEXT,
    "native_headline" TEXT,
    "native_body" TEXT,
    "native_sponsor_label" TEXT NOT NULL DEFAULT 'Sponsored',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rotation_weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaign_placements" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "placement_id" TEXT NOT NULL,
    "priority" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaign_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_events" (
    "id" TEXT NOT NULL,
    "type" "AdEventType" NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "creative_id" TEXT NOT NULL,
    "placement_id" TEXT NOT NULL,
    "session_id" TEXT,
    "context" TEXT,
    "device" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_audit_logs" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "advertisers_active_idx" ON "advertisers"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ad_placements_key_key" ON "ad_placements"("key");

-- CreateIndex
CREATE INDEX "ad_campaigns_status_idx" ON "ad_campaigns"("status");

-- CreateIndex
CREATE INDEX "ad_campaigns_advertiser_id_idx" ON "ad_campaigns"("advertiser_id");

-- CreateIndex
CREATE INDEX "ad_campaigns_start_at_idx" ON "ad_campaigns"("start_at");

-- CreateIndex
CREATE INDEX "ad_campaigns_end_at_idx" ON "ad_campaigns"("end_at");

-- CreateIndex
CREATE INDEX "ad_campaigns_status_start_at_end_at_idx" ON "ad_campaigns"("status", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "ad_creatives_campaign_id_idx" ON "ad_creatives"("campaign_id");

-- CreateIndex
CREATE INDEX "ad_creatives_active_idx" ON "ad_creatives"("active");

-- CreateIndex
CREATE INDEX "ad_campaign_placements_placement_id_enabled_idx" ON "ad_campaign_placements"("placement_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ad_campaign_placements_campaign_id_placement_id_key" ON "ad_campaign_placements"("campaign_id", "placement_id");

-- CreateIndex
CREATE INDEX "ad_events_campaign_id_created_at_idx" ON "ad_events"("campaign_id", "created_at");

-- CreateIndex
CREATE INDEX "ad_events_placement_id_created_at_idx" ON "ad_events"("placement_id", "created_at");

-- CreateIndex
CREATE INDEX "ad_events_type_created_at_idx" ON "ad_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "ad_events_campaign_id_session_id_type_created_at_idx" ON "ad_events"("campaign_id", "session_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "ad_audit_logs_campaign_id_created_at_idx" ON "ad_audit_logs"("campaign_id", "created_at");

-- CreateIndex
CREATE INDEX "ad_audit_logs_action_created_at_idx" ON "ad_audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "advertisers" ADD CONSTRAINT "advertisers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_desktop_media_id_fkey" FOREIGN KEY ("desktop_media_id") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_mobile_media_id_fkey" FOREIGN KEY ("mobile_media_id") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaign_placements" ADD CONSTRAINT "ad_campaign_placements_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaign_placements" ADD CONSTRAINT "ad_campaign_placements_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "ad_placements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "ad_creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "ad_placements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_audit_logs" ADD CONSTRAINT "ad_audit_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_audit_logs" ADD CONSTRAINT "ad_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
