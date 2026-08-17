-- Expand RelationshipType for person↔person, establishment↔establishment, company↔company.
-- EntityRelationship already allows any Entity → Entity; this clarifies semantics.

ALTER TYPE "RelationshipType" ADD VALUE 'RELATED';
ALTER TYPE "RelationshipType" ADD VALUE 'SUBSIDIARY';
ALTER TYPE "RelationshipType" ADD VALUE 'AFFILIATED';

CREATE INDEX IF NOT EXISTS "entity_relationships_relationship_type_idx"
  ON "entity_relationships"("relationship_type");
