import os

from fastapi import HTTPException
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles


class SpaFiles(StaticFiles):
    def __init__(
        self,
        directory: os.PathLike[str],
        *,
        ignore_prefixes: list[str] | None = None,
    ):
        super().__init__(
            directory=directory,
            packages=None,
            html=True,
            check_dir=True,
            follow_symlink=False,
        )
        self._ignore_prefixes = ignore_prefixes or []

    def _is_ignored(self, path: str) -> bool:
        return any(path.startswith(prefix) for prefix in self._ignore_prefixes)

    async def get_response(self, path: str, scope):
        if self._is_ignored(path):
            raise HTTPException(status_code=404)
        try:
            return await super().get_response(path, scope)
        except (HTTPException, StarletteHTTPException) as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            else:
                raise ex
