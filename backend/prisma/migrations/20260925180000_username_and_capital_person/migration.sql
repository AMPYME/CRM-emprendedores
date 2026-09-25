-- Usuario de acceso (no el correo). Se rellena con la parte local del correo hasta el próximo login.
ALTER TABLE "users" ADD COLUMN "username" TEXT;
UPDATE "users" SET "username" = split_part("email", '@', 1) WHERE "username" IS NULL OR "username" = '';
CREATE INDEX "users_username_idx" ON "users"("username");

-- Un capital semilla editable por persona.
ALTER TABLE "capital_semilla" ADD COLUMN "person_id" TEXT;
CREATE UNIQUE INDEX "capital_semilla_person_id_key" ON "capital_semilla"("person_id");
ALTER TABLE "capital_semilla" ADD CONSTRAINT "capital_semilla_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
