export type AmpymeFormStatus =
  | 'active'
  | 'draft'
  | 'future_open'
  | 'closed'
  | 'expired';

export interface AmpymeForm {
  id: number;
  form_name: string;
  description?: string | null;
  created_at?: string;
  event_date?: string;
  expires_at?: string;
  open_at?: string;
  status?: number;
  is_draft?: boolean;
  is_closed?: boolean;
  inscription_limit?: number | null;
  conferencista?: string | null;
  ubicacion?: string | null;
  submission_count?: number;
}

export interface AmpymeFormsListResult {
  forms: AmpymeForm[];
  source: 'mysql';
}

export interface AmpymeFormSubmission {
  id: number;
  user_id: number;
  submitted_at?: string | null;
  cedula?: string | null;
  nombre?: string | null;
  apellido?: string | null;
  provincia?: string | null;
  telefono?: string | null;
}
