"""
Suggestions Router — public endpoint for users to suggest new services to monitor.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Suggestion

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


class SuggestionCreate(BaseModel):
    service_name: str
    url: str
    email: str | None = None
    notes: str | None = None


class SuggestionOut(BaseModel):
    id: str
    service_name: str
    url: str
    status: str

    class Config:
        from_attributes = True


@router.post("", response_model=SuggestionOut, status_code=201)
async def create_suggestion(
    payload: SuggestionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Submit a suggestion for a new service to monitor. Open to all users."""
    if not payload.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="URL must start with http:// or https://")

    suggestion = Suggestion(
        service_name=payload.service_name.strip(),
        url=payload.url.strip(),
        email=payload.email.strip() if payload.email else None,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(suggestion)
    await db.commit()
    await db.refresh(suggestion)

    return SuggestionOut(
        id=str(suggestion.id),
        service_name=suggestion.service_name,
        url=suggestion.url,
        status=suggestion.status,
    )


@router.get("/admin", tags=["admin"])
async def list_suggestions(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all service suggestions (admin use)."""
    q = select(Suggestion).order_by(Suggestion.created_at.desc())
    if status:
        q = q.where(Suggestion.status == status)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "service_name": r.service_name,
            "url": r.url,
            "email": r.email,
            "notes": r.notes,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
