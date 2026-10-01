/**
 * Cliente HTTP hacia API SIEP (server-side).
 * CRM nunca consulta la BD de SIEP; solo este contrato JWT.
 */
import { createHash, randomUUID } from 'crypto';

const SIEP_BASE_URL = (process.env.SIEP_API_URL || 'http://localhost:4100/api/v1').replace(/\/$/, '');
const SIEP_CLIENT_ID = process.env.SIEP_CLIENT_ID || 'crm-emprendedores';
const SIEP_CLIENT_SECRET = process.env.SIEP_CLIENT_SECRET || 'crm-emprendedores-dev-secret';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export interface SiepCatalogItem {
  codigo?: string;
  id?: string;
  nombre: string;
}

export interface SiepEmpresa {
  id: string;
  ruc: string | null;
  dv: string | null;
  razonSocial: string;
  nombreComercial: string | null;
  actividad: {
    id: string;
    codigo: string;
    nombre: string;
    sector: { id: string; codigo: string; nombre: string } | null;
  } | null;
  subactividad: { id: string; codigo: string | null; nombre: string } | null;
  ubicacion: {
    provincia: { codigo: string; nombre: string } | null;
    distrito: { codigo: string; nombre: string } | null;
    corregimiento: { codigo: string; nombre: string } | null;
    direccion: string | null;
  };
  estado: { codigo: string; nombre: string } | null;
  fechaInicioAct: string | null;
  anio: string | null;
  usuarioAprobacion: string | null;
  nombreCompleto: string | null;
  fechaAprobacion: string | null;
  links?: {
    garantias: string;
    capacitaciones: string;
  };
}

export interface SiepGarantia {
  id: string;
  monto: string | null;
  fecha: string | null;
  efin: { id: string; codigo: string; nombre: string } | null;
  estado: { codigo: string; nombre: string } | null;
}

export interface SiepCapacitacion {
  id: string;
  nombre: string;
  fecha: string | null;
  programa: { id: string; codigo: string; nombre: string } | null;
}

export interface SiepPersona {
  id: string;
  documentType: string | null;
  documentNumber: string | null;
  firstName: string;
  lastName: string;
  secondLastName: string | null;
  email: string | null;
  phone: string | null;
  empresas: Array<{
    rol: string;
    id: string;
    ruc: string | null;
    razonSocial: string;
    nombreComercial: string | null;
  }>;
}

interface CatalogCacheEntry<T> {
  data: T;
  expiresAt: number;
}

const catalogCache = new Map<string, CatalogCacheEntry<unknown>>();
const CATALOG_TTL_MS = 60 * 60 * 1000; // 1h

async function fetchJson<T>(
  path: string,
  options: RequestInit & { correlationId?: string } = {}
): Promise<T> {
  const token = await getAccessToken();
  const correlationId = options.correlationId || randomUUID();
  const res = await fetch(`${SIEP_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Correlation-Id': correlationId,
      ...(options.headers || {}),
    },
  });
  const body = (await res.json().catch(() => null)) as
    | { success: boolean; data: T; error?: { message: string } }
    | null;
  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message || `SIEP HTTP ${res.status} ${path}`);
  }
  return body.data;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.accessToken;
  }
  const res = await fetch(`${SIEP_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: SIEP_CLIENT_ID,
      client_secret: SIEP_CLIENT_SECRET,
    }),
  });
  const body = (await res.json()) as {
    success?: boolean;
    data?: { access_token: string; expires_in?: string };
    error?: { message: string };
  };
  if (!res.ok || !body.data?.access_token) {
    throw new Error(body.error?.message || 'No se pudo autenticar contra SIEP');
  }
  tokenCache = {
    accessToken: body.data.access_token,
    expiresAt: now + 50 * 60 * 1000,
  };
  return tokenCache.accessToken;
}

async function cachedCatalog<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = catalogCache.get(key) as CatalogCacheEntry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.data;
  const data = await loader();
  catalogCache.set(key, { data, expiresAt: Date.now() + CATALOG_TTL_MS });
  return data;
}

export const siepClient = {
  async listProvincias(): Promise<Array<{ codigo: string; nombre: string }>> {
    return cachedCatalog('provincias', () => fetchJson('/catalogos/provincias'));
  },

  async listDistritos(provinciaCodigo: string) {
    return cachedCatalog(`distritos:${provinciaCodigo}`, () =>
      fetchJson(`/catalogos/provincias/${provinciaCodigo}/distritos`)
    );
  },

  async listSectores() {
    return cachedCatalog('sectores', () => fetchJson('/catalogos/sectores'));
  },

  async listActividades(sectorCodigo?: string) {
    const q = sectorCodigo ? `?sectorCodigo=${encodeURIComponent(sectorCodigo)}` : '';
    return cachedCatalog(`actividades:${sectorCodigo || 'all'}`, () =>
      fetchJson(`/catalogos/actividades${q}`)
    );
  },

  async findEmpresaByRuc(ruc: string): Promise<SiepEmpresa | null> {
    const data = await fetchJson<SiepEmpresa[]>(
      `/empresas?ruc=${encodeURIComponent(ruc)}&limit=1`
    );
    return data[0] ?? null;
  },

  async getEmpresa(publicId: string): Promise<SiepEmpresa> {
    return fetchJson(`/empresas/${publicId}`);
  },

  async getEmpresaGarantias(publicId: string): Promise<SiepGarantia[]> {
    return fetchJson(`/empresas/${publicId}/garantias`);
  },

  async getEmpresaCapacitaciones(publicId: string): Promise<SiepCapacitacion[]> {
    return fetchJson(`/empresas/${publicId}/capacitaciones`);
  },

  async findPersonaByDocumento(documento: string): Promise<SiepPersona | null> {
    const data = await fetchJson<SiepPersona[]>(
      `/personas?documento=${encodeURIComponent(documento)}`
    );
    return data[0] ?? null;
  },

  async getPersona(publicId: string): Promise<SiepPersona> {
    return fetchJson(`/personas/${publicId}`);
  },

  /** Invalida caché de catálogos (p. ej. tras refresh admin). */
  clearCatalogCache() {
    catalogCache.clear();
  },

  /** Hash util para tests de secreto (espejo SIEP). */
  hashSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  },
};
