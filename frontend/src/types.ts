export interface Job {
  id: number;
  hh_id: string;
  title: string;
  company: string;
  salary: string | null;
  location: string | null;
  experience: string | null;
  employment_type: string | null;
  description: string | null;
  url: string;
  is_match: boolean | null;
  match_reason: string | null;
}

export interface SearchSession {
  id: number;
  user_prompt: string;
  generated_queries: string | null;
  status: string;
  created_at: string;
  jobs: Job[];
}

export interface SearchStatus {
  id: number;
  status: string;
  total_jobs: number;
  analyzed_jobs: number;
  matched_jobs: number;
  current_query: string;
  scraped_count: number;
  generated_queries: string | null;
}
