-- CreateEnum
CREATE TYPE "EmployerMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- AlterTable
ALTER TABLE "employer_memberships" ADD COLUMN     "invited_at" TIMESTAMP(3),
ADD COLUMN     "invited_by_id" TEXT,
ADD COLUMN     "status" "EmployerMembershipStatus" NOT NULL DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE "employer_memberships" ADD CONSTRAINT "employer_memberships_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
