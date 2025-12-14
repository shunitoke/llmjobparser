from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class SearchSession(Base):
    __tablename__ = "search_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_prompt = Column(Text, nullable=False)
    generated_queries = Column(Text)  # JSON list of search queries
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="pending")  # pending, scraping, analyzing, completed
    current_query = Column(String(200), default="")  # текущий поисковый запрос
    scraped_count = Column(Integer, default=0)  # сколько вакансий спарсено
    
    jobs = relationship("Job", back_populates="session")


class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("search_sessions.id"))
    hh_id = Column(String(50), unique=True, index=True)
    title = Column(String(500))
    company = Column(String(500))
    salary = Column(String(200))
    location = Column(String(200))
    experience = Column(String(100))
    employment_type = Column(String(100))
    description = Column(Text)
    url = Column(String(1000))
    published_at = Column(DateTime)
    
    is_match = Column(Boolean, default=None)
    match_reason = Column(Text)
    analyzed_at = Column(DateTime)
    
    session = relationship("SearchSession", back_populates="jobs")
