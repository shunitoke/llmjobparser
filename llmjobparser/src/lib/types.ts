export type Region = string;
export type Category = string;

export type SearchInput = {
  prompt: string;
  regions: Region[];
  categories: Category[];
  includePrivate: boolean;
};

export type Vacancy = {
  id: string;
  title: string;
  company: string;
  location: string;
  summary: string;
  badges: string[];
};

export type VacancyBatch = {
  vacancies: Vacancy[];
  pending: boolean;
  lastFetched?: number;
};

export type SearchResponse = {
  items: Vacancy[];
  batchStatus: {
    [key: string]: {
      pending: boolean;
      refreshTriggered?: boolean;
    };
  };
};
