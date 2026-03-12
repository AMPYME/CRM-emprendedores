/**
 * Servicio de eventos e inscripciones.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams } from '@/types/api.types';
import type { Event, EventRegistration } from '@/types/entities.types';

interface GetEventsParams extends PaginationParams {
  status?: string;
  eventType?: string;
  province?: string;
}

interface CreateEventInput {
  name: string;
  description?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  province?: string;
  maxCapacity?: number;
  formFields?: unknown;
}

type UpdateEventInput = Partial<CreateEventInput>;

interface CreateRegistrationInput {
  entityId: string;
  notes?: string;
}

interface UpdateRegistrationInput {
  status?: string;
  notes?: string;
}

export const eventsService = {
  async list(params?: GetEventsParams): Promise<ApiResponse<Event[]>> {
    const res = await apiClient.get<ApiResponse<Event[]>>('/events', { params });
    return res.data;
  },

  async getById(id: string): Promise<Event> {
    const res = await apiClient.get<ApiResponse<Event>>(`/events/${id}`);
    return res.data.data;
  },

  async create(data: CreateEventInput): Promise<Event> {
    const res = await apiClient.post<ApiResponse<Event>>('/events', data);
    return res.data.data;
  },

  async update(id: string, data: UpdateEventInput): Promise<Event> {
    const res = await apiClient.put<ApiResponse<Event>>(`/events/${id}`, data);
    return res.data.data;
  },

  async cancel(id: string): Promise<void> {
    await apiClient.delete(`/events/${id}`);
  },

  // Inscripciones
  async listRegistrations(eventId: string, params?: PaginationParams): Promise<ApiResponse<EventRegistration[]>> {
    const res = await apiClient.get<ApiResponse<EventRegistration[]>>(`/events/${eventId}/registrations`, { params });
    return res.data;
  },

  async createRegistration(eventId: string, data: CreateRegistrationInput): Promise<EventRegistration> {
    const res = await apiClient.post<ApiResponse<EventRegistration>>(`/events/${eventId}/registrations`, data);
    return res.data.data;
  },

  async listEntityRegistrations(entityId: string): Promise<EventRegistration[]> {
    const res = await apiClient.get<ApiResponse<EventRegistration[]>>(`/entities/${entityId}/registrations`);
    return res.data.data;
  },

  async updateRegistration(id: string, data: UpdateRegistrationInput): Promise<EventRegistration> {
    const res = await apiClient.put<ApiResponse<EventRegistration>>(`/registrations/${id}`, data);
    return res.data.data;
  },

  async removeRegistration(id: string): Promise<void> {
    await apiClient.delete(`/registrations/${id}`);
  },
};
