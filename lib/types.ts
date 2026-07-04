export type Role = "owner" | "staff";

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Subcontractor = {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  trade: string | null;
  address: string | null;
  created_at: string;
};
