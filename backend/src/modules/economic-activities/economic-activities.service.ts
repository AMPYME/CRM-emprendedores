/**
 * Servicio de actividades económicas CINU 4.1.
 * Toda lectura/escritura operativa pasa por funciones PostgreSQL.
 */
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/errors/app-error';
import type { AuditActor } from '../audit/audit.service';
import {
  economicActivitiesRepository,
  type EntityEconomicActivityRow,
} from './economic-activities.repository';
import type {
  AssignEconomicActivityInput,
  CinuSearchQuery,
} from './economic-activities.validator';
import {
  prepareCinuImport,
  type CinuPreparedCatalog,
} from './cinu-catalog';

function mapPgError(err: unknown): never {
  const raw = err instanceof Error ? err.message : String(err);
  const message =
    raw.replace(/^Error occurred during query execution:.*?Message:\s*/is, '').trim() || raw;
  if (/no encontrada|no encontrado|inexistente/i.test(message)) {
    throw new AppError(message, 404, 'NOT_FOUND');
  }
  if (/ya tiene|solo puede existir|duplicad/i.test(message)) {
    throw new ConflictError(message);
  }
  if (/inválid|requiere|no pertenece|misma versión|formato|búsqueda/i.test(message)) {
    throw new BadRequestError(message);
  }
  throw err instanceof Error ? err : new BadRequestError(message);
}

function mapActivity(row: EntityEconomicActivityRow) {
  return {
    id: row.id,
    entityId: row.entity_id,
    cinuClassId: row.cinu_class_id,
    cinuSubclassId: row.cinu_subclass_id,
    isPrimary: row.is_primary,
    specificActivity: row.specific_activity,
    hasNoticeOfOperation: row.has_notice_of_operation,
    classCode: row.class_code,
    className: row.class_name,
    subclassCode: row.subclass_code,
    subclassName: row.subclass_name,
    groupCode: row.group_code,
    groupName: row.group_name,
    divisionCode: row.division_code,
    divisionName: row.division_name,
    categoryCode: row.category_code,
    categoryName: row.category_name,
    versionCode: row.version_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export const economicActivitiesService = {
  async listCategories(versionCode?: string) {
    try {
      const rows = await economicActivitiesRepository.listCategories(versionCode ?? null);
      return rows.map((r) => ({
        id: r.id,
        versionId: r.version_id,
        versionCode: r.version_code,
        code: r.code,
        name: r.name,
      }));
    } catch (err) {
      mapPgError(err);
    }
  },

  async listDivisions(categoryId: string) {
    try {
      const rows = await economicActivitiesRepository.listDivisions(categoryId);
      return rows.map((r) => ({
        id: r.id,
        versionId: r.version_id,
        categoryId: r.category_id,
        code: r.code,
        name: r.name,
      }));
    } catch (err) {
      mapPgError(err);
    }
  },

  async listGroups(divisionId: string) {
    try {
      const rows = await economicActivitiesRepository.listGroups(divisionId);
      return rows.map((r) => ({
        id: r.id,
        versionId: r.version_id,
        divisionId: r.division_id,
        code: r.code,
        name: r.name,
      }));
    } catch (err) {
      mapPgError(err);
    }
  },

  async listClasses(groupId: string) {
    try {
      const rows = await economicActivitiesRepository.listClasses(groupId);
      return rows.map((r) => ({
        id: r.id,
        versionId: r.version_id,
        groupId: r.group_id,
        code: r.code,
        name: r.name,
      }));
    } catch (err) {
      mapPgError(err);
    }
  },

  async listSubclasses(classId: string) {
    try {
      const rows = await economicActivitiesRepository.listSubclasses(classId);
      return rows.map((r) => ({
        id: r.id,
        versionId: r.version_id,
        classId: r.class_id,
        code: r.code,
        name: r.name,
      }));
    } catch (err) {
      mapPgError(err);
    }
  },

  async search(query: CinuSearchQuery) {
    try {
      const rows = await economicActivitiesRepository.search(query.q, query.limit);
      return rows.map((r) => ({
        level: r.level,
        id: r.id,
        code: r.code,
        name: r.name,
        classId: r.class_id,
        classCode: r.class_code,
        className: r.class_name,
        groupCode: r.group_code,
        divisionCode: r.division_code,
        categoryCode: r.category_code,
        versionCode: r.version_code,
      }));
    } catch (err) {
      mapPgError(err);
    }
  },

  async listByEntity(entityId: string) {
    try {
      const rows = await economicActivitiesRepository.listByEntity(entityId);
      return rows.map(mapActivity);
    } catch (err) {
      mapPgError(err);
    }
  },

  async assign(entityId: string, input: AssignEconomicActivityInput, actor?: AuditActor) {
    try {
      const row = await economicActivitiesRepository.assign(
        entityId,
        input.cinuClassId,
        input.cinuSubclassId ?? null,
        input.isPrimary ?? false,
        actor?.userId ?? null,
        input.specificActivity ?? null,
        input.hasNoticeOfOperation ?? null
      );
      if (!row) throw new BadRequestError('No se pudo asignar la actividad económica');
      return mapActivity(row);
    } catch (err) {
      mapPgError(err);
    }
  },

  async setPrimary(entityId: string, activityId: string, actor?: AuditActor) {
    try {
      const row = await economicActivitiesRepository.setPrimary(
        entityId,
        activityId,
        actor?.userId ?? null
      );
      if (!row) throw new NotFoundError('Actividad económica', activityId);
      return mapActivity(row);
    } catch (err) {
      mapPgError(err);
    }
  },

  async remove(entityId: string, activityId: string, actor?: AuditActor) {
    try {
      const row = await economicActivitiesRepository.remove(
        entityId,
        activityId,
        actor?.userId ?? null
      );
      if (!row) throw new NotFoundError('Actividad económica', activityId);
      return mapActivity(row);
    } catch (err) {
      mapPgError(err);
    }
  },

  /**
   * Importación idempotente del catálogo preparado.
   * Conserva textos originales; reporta errores y advertencias de validación.
   */
  async importCatalog(raw: unknown): Promise<{
    prepared: CinuPreparedCatalog;
    imported: {
      categories: number;
      divisions: number;
      groups: number;
      classes: number;
      subclasses: number;
      inserted: {
        categories: number;
        divisions: number;
        groups: number;
        classes: number;
        subclasses: number;
      };
      updated: {
        categories: number;
        divisions: number;
        groups: number;
        classes: number;
        subclasses: number;
      };
    };
  }> {
    const prepared = prepareCinuImport(raw);
    if (prepared.counts.errors > 0 && prepared.categories.length === 0) {
      throw new BadRequestError('El catálogo CINU no es válido', {
        issues: prepared.issues,
      });
    }

    const version = await economicActivitiesRepository.upsertVersion(
      prepared.versionCode,
      prepared.versionName,
      prepared.source
    );
    if (!version?.out_id) {
      throw new BadRequestError('No se pudo crear/actualizar la versión CINU');
    }

    const inserted = {
      categories: 0,
      divisions: 0,
      groups: 0,
      classes: 0,
      subclasses: 0,
    };
    const updated = {
      categories: 0,
      divisions: 0,
      groups: 0,
      classes: 0,
      subclasses: 0,
    };

    for (const category of prepared.categories) {
      const cat = await economicActivitiesRepository.upsertCategory(
        version.out_id,
        category.code,
        category.nombre
      );
      if (!cat?.out_id) continue;
      if (cat.out_inserted) inserted.categories += 1;
      else updated.categories += 1;

      for (const division of category.divisions) {
        const div = await economicActivitiesRepository.upsertDivision(
          cat.out_id,
          division.code,
          division.nombre
        );
        if (!div?.out_id) continue;
        if (div.out_inserted) inserted.divisions += 1;
        else updated.divisions += 1;

        for (const group of division.groups) {
          const grp = await economicActivitiesRepository.upsertGroup(
            div.out_id,
            group.code,
            group.nombre
          );
          if (!grp?.out_id) continue;
          if (grp.out_inserted) inserted.groups += 1;
          else updated.groups += 1;

          for (const clase of group.classes) {
            const cls = await economicActivitiesRepository.upsertClass(
              grp.out_id,
              clase.code,
              clase.nombre
            );
            if (!cls?.out_id) continue;
            if (cls.out_inserted) inserted.classes += 1;
            else updated.classes += 1;

            for (const subclass of clase.subclasses) {
              const sub = await economicActivitiesRepository.upsertSubclass(
                cls.out_id,
                subclass.code,
                subclass.nombre
              );
              if (!sub?.out_id) continue;
              if (sub.out_inserted) inserted.subclasses += 1;
              else updated.subclasses += 1;
            }
          }
        }
      }
    }

    return {
      prepared,
      imported: {
        categories: prepared.counts.categories,
        divisions: prepared.counts.divisions,
        groups: prepared.counts.groups,
        classes: prepared.counts.classes,
        subclasses: prepared.counts.subclasses,
        inserted,
        updated,
      },
    };
  },
};
