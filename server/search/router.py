import itertools
import re

from fastapi import APIRouter

from search.models import SearchResults
from search.search import search_tasks, search_workers

search_router = APIRouter(prefix="/api/search", tags=["search"])


@search_router.get("/")
async def search(query: str, limit: int = 10) -> SearchResults:
    query_re = re.compile(query, re.IGNORECASE)
    workers_iter = search_workers(query_re)
    tasks_iter = search_tasks(query_re)
    return SearchResults(
        workers=list(itertools.islice(workers_iter, limit)),
        tasks=list(itertools.islice(tasks_iter, limit)),
    )
