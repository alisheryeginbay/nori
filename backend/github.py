import subprocess
import tempfile
from pathlib import Path

from chunks import chunk_file, SUPPORTED_EXTENSIONS


def clone_repo(repo_url: str, dest: Path):
    subprocess.run(["git", "clone", "--depth", "1", repo_url, str(dest)], check=True)


async def index_repo(repo_url: str) -> list[dict]:
    """Clone and index a repository, returning chunks for all supported languages."""
    all_chunks = []

    with tempfile.TemporaryDirectory() as tmpdir:
        dest = Path(tmpdir)
        clone_repo(repo_url, dest)

        for file in dest.rglob("*"):
            # Skip non-files and unsupported extensions
            if not file.is_file():
                continue
            if file.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue
            # Skip hidden files and common non-code directories
            if any(part.startswith(".") for part in file.parts):
                continue
            skip_dirs = {
                "node_modules", "vendor", "dist", "build", "__pycache__",
                "venv", ".venv", "env", ".env", "target",  # virtual envs & build outputs
                "test", "tests", "__tests__", "spec", "specs",  # test directories
                "examples", "example", "samples", "sample", "demo", "demos",  # examples
                "docs", "documentation", "doc",  # documentation
                "fixtures", "mocks", "__mocks__", "testdata",  # test data
                ".git", ".svn", ".hg",  # version control
                "coverage", ".nyc_output", "htmlcov",  # coverage reports
                "migrations", "seeds",  # database migrations
                "assets", "static", "public", "images", "fonts",  # static assets
            }
            if any(part.lower() in skip_dirs for part in file.parts):
                continue
            # Skip large files (>100KB likely minified or data files)
            if file.stat().st_size > 100_000:
                continue

            try:
                content = file.read_text(encoding="utf-8", errors="ignore")
                relative_path = str(file.relative_to(dest))
                chunks = chunk_file(content, relative_path)
                all_chunks.extend(chunks)
            except Exception:
                continue  # Skip files that can't be read

    return all_chunks
