/**
 * Acceso a catálogo CINU y actividades económicas vía api.fn_* únicamente.
 * Sin create/update/delete/findMany de Prisma sobre tablas protegidas.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { queryApi, queryApiFirst } from '../../infrastructure/database/api-caller';

export type CinuCategoryRow = {
  id: string;
  version_id: string;
  version_code: string;
  code: string;
  name: string;
};

export type CinuChildRow = {
  id: string;
  version_id: string;
  code: string;
  name: string;
  category_id?: string;
  division_id?: string;
  group_id?: string;
  class_id?: string;
};

export type EconomicActivitySearchRow = {
  level: string;
  id: string;
  code: string;
  name: string;
  class_id: string;
  class_code: string;
  class_name: string;
  group_code: string;
  division_code: string;
  category_code: string;
  version_code: string;
};

export type EntityEconomicActivityRow = {
  id: string;
  entity_id: string;
  cinu_class_id: string;
  cinu_subclass_id: string | null;
  is_primary: boolean;
  specific_activity: string | null;
  has_notice_of_operation: boolean | null;
  class_code: string;
  class_name: string;
  subclass_code: string | null;
  subclass_name: string | null;
  group_code: string;
  group_name: string;
  division_code: string;
  division_name: string;
  category_code: string;
  category_name: string;
  version_code: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type UpsertFlagRow = { out_id: string; out_inserted: boolean };

export const economicActivitiesRepository = {
  listCategories(versionCode?: string | null) {
    return queryApi<CinuCategoryRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_get_cinu_categories(${versionCode ?? null}::text)`
    );
  },

  listDivisions(categoryId: string) {
    return queryApi<CinuChildRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_get_cinu_divisions(${categoryId}::text)`
    );
  },

  listGroups(divisionId: string) {
    return queryApi<CinuChildRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_get_cinu_groups(${divisionId}::text)`
    );
  },

  listClasses(groupId: string) {
    return queryApi<CinuChildRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_get_cinu_classes(${groupId}::text)`
    );
  },

  listSubclasses(classId: string) {
    return queryApi<CinuChildRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_get_cinu_subclasses(${classId}::text)`
    );
  },

  search(query: string, limit: number) {
    return queryApi<EconomicActivitySearchRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_search_economic_activities(${query}::text, ${limit}::int)`
    );
  },

  listByEntity(entityId: string) {
    return queryApi<EntityEconomicActivityRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_get_entity_economic_activities(${entityId}::text)`
    );
  },

  async listEntityIdsByCinuFilter(input: {
    categoryId?: string;
    divisionId?: string;
  }): Promise<string[]> {
    if (!input.categoryId && !input.divisionId) return [];
    const rows = await queryApi<{ entity_id: string }>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_entity_ids_by_cinu_filter(
        ${input.categoryId ?? null}::text,
        ${input.divisionId ?? null}::text
      )`
    );
    return rows.map((r) => r.entity_id);
  },

  assign(
    entityId: string,
    classId: string,
    subclassId: string | null,
    isPrimary: boolean,
    actorId: string | null,
    specificActivity: string | null,
    hasNoticeOfOperation: boolean | null
  ) {
    return queryApiFirst<EntityEconomicActivityRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_assign_entity_economic_activity(
        ${entityId}::text,
        ${classId}::text,
        ${subclassId}::text,
        ${isPrimary}::boolean,
        ${actorId}::text,
        ${specificActivity}::text,
        ${hasNoticeOfOperation}::boolean
      )`
    );
  },

  setPrimary(entityId: string, activityId: string, actorId: string | null) {
    return queryApiFirst<EntityEconomicActivityRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_set_primary_economic_activity(
        ${entityId}::text,
        ${activityId}::text,
        ${actorId}::text
      )`
    );
  },

  remove(entityId: string, activityId: string, actorId: string | null) {
    return queryApiFirst<EntityEconomicActivityRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_remove_entity_economic_activity(
        ${entityId}::text,
        ${activityId}::text,
        ${actorId}::text
      )`
    );
  },

  upsertVersion(code: string, name: string, source: string | null) {
    return queryApiFirst<UpsertFlagRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_upsert_cinu_version(
        ${code}::text,
        ${name}::text,
        ${source}::text
      )`
    );
  },

  upsertCategory(versionId: string, code: string, name: string) {
    return queryApiFirst<UpsertFlagRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_upsert_cinu_category(
        ${versionId}::text,
        ${code}::text,
        ${name}::text
      )`
    );
  },

  upsertDivision(categoryId: string, code: string, name: string) {
    return queryApiFirst<UpsertFlagRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_upsert_cinu_division(
        ${categoryId}::text,
        ${code}::text,
        ${name}::text
      )`
    );
  },

  upsertGroup(divisionId: string, code: string, name: string) {
    return queryApiFirst<UpsertFlagRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_upsert_cinu_group(
        ${divisionId}::text,
        ${code}::text,
        ${name}::text
      )`
    );
  },

  upsertClass(groupId: string, code: string, name: string) {
    return queryApiFirst<UpsertFlagRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_upsert_cinu_class(
        ${groupId}::text,
        ${code}::text,
        ${name}::text
      )`
    );
  },

  upsertSubclass(classId: string, code: string, name: string) {
    return queryApiFirst<UpsertFlagRow>(
      prisma,
      Prisma.sql`SELECT * FROM api.fn_upsert_cinu_subclass(
        ${classId}::text,
        ${code}::text,
        ${name}::text
      )`
    );
  },
};
