-- Prisma manages "updated_at" (@updatedAt) itself; the DEFAULT used to seed the two initial rows is not part of the model.
ALTER TABLE "homepage_configurations" ALTER COLUMN "updated_at" DROP DEFAULT;
