import { apiClient } from './api-client';
import type { ApiResponse } from '@/types/api.types';

export interface SiepPersonaEmpresa {
  rol: string;
  id: string;
  ruc: string | null;
  razonSocial: string;
  nombreComercial: string | null;
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
  empresas: SiepPersonaEmpresa[];
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

export const siepService = {
  async findPersonaByCedula(documento: string): Promise<SiepPersona | null> {
    const res = await apiClient.get<ApiResponse<SiepPersona | null>>('/siep/personas', {
      params: { documento },
    });
    return res.data.data ?? null;
  },

  async getEmpresa(id: string): Promise<SiepEmpresa> {
    const res = await apiClient.get<ApiResponse<SiepEmpresa>>(`/siep/empresas/${id}`);
    return res.data.data;
  },

  async getEmpresaGarantias(id: string): Promise<SiepGarantia[]> {
    const res = await apiClient.get<ApiResponse<SiepGarantia[]>>(`/siep/empresas/${id}/garantias`);
    return res.data.data ?? [];
  },

  async getEmpresaCapacitaciones(id: string): Promise<SiepCapacitacion[]> {
    const res = await apiClient.get<ApiResponse<SiepCapacitacion[]>>(
      `/siep/empresas/${id}/capacitaciones`
    );
    return res.data.data ?? [];
  },
};
