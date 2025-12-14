from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class SearchRequest(BaseModel):
    prompt: str
    city: str = ""
    categories: List[str] = []


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
    is_match: Optional[bool]
    match_reason: Optional[str]
    
    class Config:
        from_attributes = True


class SearchSessionResponse(BaseModel):
    id: int
    user_prompt: str
    generated_queries: Optional[str]
    status: str
    created_at: datetime
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
    scraped_count: int = 0
    generated_queries: Optional[str] = None
