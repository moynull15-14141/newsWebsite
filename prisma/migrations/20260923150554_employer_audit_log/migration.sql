-- CreateTable
CREATE TABLE "employer_audit_logs" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employer_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employer_audit_logs_employer_id_created_at_idx" ON "employer_audit_logs"("employer_id", "created_at");

-- CreateIndex
CREATE INDEX "employer_audit_logs_action_created_at_idx" ON "employer_audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "employer_audit_logs" ADD CONSTRAINT "employer_audit_logs_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_audit_logs" ADD CONSTRAINT "employer_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

