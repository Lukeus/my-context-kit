"""
Context Kit Service - FastAPI Application

Python sidecar service for Context Kit pipeline orchestration with LangChain.
"""

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .endpoints import codegen, inspect, promptify, spec, spec_log, assistant
from .models.responses import HealthResponse
import asyncio
import threading
import os
import signal

# Service start time for uptime calculation
START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Lifecycle manager for FastAPI application.
    Handles startup and shutdown operations.
    """
    # Startup
    print("[Context Kit Service] Starting...")
    print(f"[Context Kit Service] Version: {app.version}")
    print("[Context Kit Service] Docs: http://127.0.0.1:8000/docs")

    yield

    # Shutdown
    print("[Context Kit Service] Shutting down...")


# Create FastAPI application
app = FastAPI(
    title="Context Kit Service",
    description="Python sidecar service for Context Kit pipeline orchestration",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS for Electron renderer
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint with service information."""
    return {
        "service": "Context Kit Service",
        "version": app.version,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """
    Health check endpoint.
    Returns service status and dependency information.
    """
    uptime = time.time() - START_TIME

    # Check dependency availability
    dependencies: dict[str, str] = {}

    try:
        import langchain  # noqa: F401

        dependencies["langchain"] = "available"
    except ImportError:
        dependencies["langchain"] = "unavailable"

    try:
        import langchain_openai  # noqa: F401

        dependencies["langchain_openai"] = "available"
    except ImportError:
        dependencies["langchain_openai"] = "unavailable"

    try:
        import yaml  # noqa: F401

        dependencies["yaml"] = "available"
    except ImportError:
        dependencies["yaml"] = "unavailable"

    # Determine overall status
    if all(status == "available" for status in dependencies.values()):
        status = "healthy"
    elif any(status == "available" for status in dependencies.values()):
        status = "degraded"
    else:
        status = "unhealthy"

    return HealthResponse(
        status=status,
        version=app.version,
        uptime_seconds=uptime,
        dependencies=dependencies,
    )


# Include endpoint routers
app.include_router(assistant.router, tags=["Assistant"])
app.include_router(inspect.router, prefix="/context", tags=["Context Inspection"])
app.include_router(spec.router, prefix="/spec", tags=["Specification Generation"])
app.include_router(promptify.router, prefix="/spec", tags=["Promptification"])
app.include_router(codegen.router, prefix="/codegen", tags=["Code Generation"])
app.include_router(spec_log.router, prefix="/spec-log", tags=["Spec Logs"])


@app.post("/shutdown")
async def shutdown(request: Request) -> JSONResponse:  # type: ignore[override]
    """Trigger graceful application shutdown.

    This endpoint is invoked by the Electron host prior to process termination to allow
    in-flight requests to complete. It schedules a server shutdown on the next
    asyncio loop iteration and returns immediately. If the hosting environment does
    not honor lifespan shutdown automatically, a fallback signal (SIGTERM) is sent after
    a short delay.

    NOTE: Authentication is not implemented because the sidecar is bound to localhost.
    If exposure scope changes, add a shared secret or IPC-gated token.
    """

    # Schedule FastAPI / uvicorn shutdown by stopping the event loop soon.
    loop = asyncio.get_event_loop()

    def _delayed_terminate():  # pragma: no cover - timing utility
        try:
            # Attempt clean signal for uvicorn
            if os.name == "nt":
                # Windows: use CTRL_BREAK_EVENT equivalent fallback by terminating process
                os.kill(os.getpid(), signal.SIGTERM)
            else:
                os.kill(os.getpid(), signal.SIGTERM)
        except Exception as e:  # noqa: BLE001
            print(f"[Context Kit Service] Shutdown signal error: {e}")

    # Give a small grace period for the HTTP response to flush before signaling
    threading.Timer(0.25, _delayed_terminate).start()

    return JSONResponse({"status": "shutdown-initiated"})


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception) -> JSONResponse:
    """Global exception handler for unhandled errors."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
            "type": type(exc).__name__,
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "context_kit_service.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
    )
