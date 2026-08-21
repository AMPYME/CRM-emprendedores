export interface AmpymeFormRow {
  id: number;
  form_name: string;
  description: string | null;
  created_at: string | null;
  event_date: string | null;
  expires_at: string | null;
  open_at: string | null;
  status: number;
  is_draft: number | boolean;
  is_closed: number | boolean;
  closed_at: string | null;
  inscription_limit: number | null;
  conferencista: string | null;
  ubicacion: string | null;
  submission_count?: number | null;
}

export interface AmpymeFormRecord {
  id: number;
  form_name: string;
  description?: string | null;
  created_at?: string | null;
  event_date?: string | null;
  expires_at?: string | null;
  open_at?: string | null;
  status?: number;
  is_draft?: boolean;
  is_closed?: boolean;
  closed_at?: string | null;
  inscription_limit?: number | null;
  conferencista?: string | null;
  ubicacion?: string | null;
  submission_count?: number;
}

export interface AmpymeFormsListPayload {
  forms: AmpymeFormRecord[];
  source: 'mysql';
}

export interface AmpymeFormSubmissionRow {
  id: number;
  user_id: number;
  submitted_at: string | null;
  cedula: string | null;
  nombre: string | null;
  apellido: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
}

export interface AmpymeFormSubmissionsPayload {
  data: AmpymeFormSubmissionRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
