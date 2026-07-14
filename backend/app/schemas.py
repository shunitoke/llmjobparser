from typing import List, Optional, Literal
from datetime import datetime
from pydantic import BaseModel


class SearchRequest(BaseModel):
    prompt: str
    city: str = ""
    categories: List[str] = []
    search_mode: Literal["ru", "global", "telegram"] = "ru"


class JobResponse(BaseModel):
    id: int
    hh_id: str
    title: str
    company: str
    salary: Optional[str]
    location: Optional[str]
    experience: Optional[str]
    employment_type: Optional[str]
    description: Optional[str]
    url: str
    published_at: Optional[datetime] = None
    is_match: Optional[bool]
    match_reason: Optional[str]

    class Config:
        from_attributes = True


class CandidateJobResponse(BaseModel):
    id: int
    hh_id: str
    title: str
    company: str
    salary: Optional[str]
    location: Optional[str]
    url: str
    source: str
    category: Optional[str]
    selected: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateListResponse(BaseModel):
    total: int
    offset: int
    limit: int
    items: List[CandidateJobResponse]


class SearchSessionResponse(BaseModel):
    id: int
    user_prompt: str
    generated_queries: Optional[str]
    status: str
    created_at: datetime
    current_source: Optional[str]
    candidates_count: int = 0
    selected_count: int = 0
    scraped_count: int = 0
    jobs: List[JobResponse] = []

    class Config:
        from_attributes = True


class SearchStatusResponse(BaseModel):
    id: int
    status: str
    total_jobs: int
    analyzed_jobs: int
    matched_jobs: int
    current_query: str = ""
    current_source: str = ""
    candidates_count: int = 0
    selected_count: int = 0
    scraped_count: int = 0
    generated_queries: Optional[str] = None
