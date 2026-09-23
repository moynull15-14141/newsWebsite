-- CreateEnum
CREATE TYPE "EmployerVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmployerMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'RECRUITER');

-- CreateEnum
CREATE TYPE "JobPostingPlanType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "EmployerStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "employers" ADD COLUMN     "company_size" TEXT,
ADD COLUMN     "cover_media_id" TEXT,
ADD COLUMN     "founded_year" INTEGER,
ADD COLUMN     "is_self_service" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verification_note" TEXT,
ADD COLUMN     "verification_status" "EmployerVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by_id" TEXT;

-- CreateTable
CREATE TABLE "employer_memberships" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "EmployerMembershipRole" NOT NULL DEFAULT 'RECRUITER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employer_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_posting_plans" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "JobPostingPlanType" NOT NULL,
    "price_amount" INTEGER,
    "price_currency" TEXT DEFAULT 'BDT',
    "duration_days" INTEGER NOT NULL,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_posting_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_posting_orders" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "provider_ref" TEXT,
    "created_by_id" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_posting_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employer_memberships_user_id_idx" ON "employer_memberships"("user_id");

-- CreateIndex
CREATE INDEX "employer_memberships_employer_id_idx" ON "employer_memberships"("employer_id");

-- CreateIndex
CREATE UNIQUE INDEX "employer_memberships_employer_id_user_id_key" ON "employer_memberships"("employer_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_posting_plans_key_key" ON "job_posting_plans"("key");

-- CreateIndex
CREATE INDEX "job_posting_orders_employer_id_idx" ON "job_posting_orders"("employer_id");

-- CreateIndex
CREATE INDEX "job_posting_orders_job_id_idx" ON "job_posting_orders"("job_id");

-- CreateIndex
CREATE INDEX "job_posting_orders_status_idx" ON "job_posting_orders"("status");

-- CreateIndex
CREATE INDEX "employers_verification_status_idx" ON "employers"("verification_status");

-- AddForeignKey
ALTER TABLE "employers" ADD CONSTRAINT "employers_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employers" ADD CONSTRAINT "employers_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_memberships" ADD CONSTRAINT "employer_memberships_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_memberships" ADD CONSTRAINT "employer_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_posting_orders" ADD CONSTRAINT "job_posting_orders_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_posting_orders" ADD CONSTRAINT "job_posting_orders_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_posting_orders" ADD CONSTRAINT "job_posting_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "job_posting_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_posting_orders" ADD CONSTRAINT "job_posting_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

