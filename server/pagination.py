from collections.abc import Iterable
from itertools import islice
from typing import Generic, TypeVar

from pydantic import BaseModel, Field
from starlette.requests import Request

T = TypeVar("T")


class Paginated(BaseModel, Generic[T]):
    count: int
    next: str | None
    previous: str | None
    results: list[T] = Field()


def get_paginated_response(items: Iterable[T], count: int, request: Request, limit: int, offset: int) -> Paginated[T]:
    # TODO restrict negative values
    next_url = (
        str(request.url.replace_query_params(offset=offset + limit, limit=min(limit, count - offset - limit)))
        if offset + limit < count
        else None
    )
    previous_url = (
        str(request.url.replace_query_params(offset=max(0, offset - limit), limit=limit)) if count > 0 else None
    )
    return Paginated(
        count=count,
        previous=previous_url,
        next=next_url,
        results=list(islice(items, offset, offset + limit)),
    )
