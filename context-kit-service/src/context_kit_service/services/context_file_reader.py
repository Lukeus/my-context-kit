"""Context file reader service."""

import asyncio
from pathlib import Path
from typing import Optional

import aiofiles


class ContextFileReader:
    """Reads files from context repositories."""

    async def read_file(
        self, repo_path: str, relative_path: str, encoding: str = "utf-8"
    ) -> dict[str, any]:
        """Read a file from the context repository."""
        repo = Path(repo_path)
        file_path = repo / relative_path

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {relative_path}")

        # Security: Ensure file is within repo
        try:
            file_path.resolve().relative_to(repo.resolve())
        except ValueError:
            raise ValueError("Path traversal attempt detected")

        try:
            async with aiofiles.open(file_path, "r", encoding=encoding) as f:
                content = await f.read()

            stat = file_path.stat()

            return {
                "path": str(file_path),
                "repoRelativePath": relative_path,
                "content": content,
                "encoding": encoding,
                "size": stat.st_size,
                "lastModified": stat.st_mtime,
                "truncated": False,
            }

        except Exception as e:
            raise RuntimeError(f"Error reading file: {str(e)}")


# Global instance
_reader: Optional[ContextFileReader] = None


def get_context_file_reader() -> ContextFileReader:
    """Get global context file reader instance."""
    global _reader
    if _reader is None:
        _reader = ContextFileReader()
    return _reader
