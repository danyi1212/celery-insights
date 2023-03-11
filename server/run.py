import uvicorn

from settings import settings

if __name__ == '__main__':
    uvicorn.run(
        app="app:app",
        host="0.0.0.0",
        port=8555,
        reload=settings.debug,
    )
