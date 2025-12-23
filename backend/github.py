import subprocess
import tempfile
from pathlib import Path

from chunks import chunk_file, SUPPORTED_EXTENSIONS
from errors import GitCloneError, handle_subprocess_error


def clone_repo(repo_url: str, dest: Path):
    """
    Clone the git repository at repo_url into dest as a shallow (depth 1) clone.
    
    Parameters:
        repo_url (str): Repository URL to clone.
        dest (Path): Destination directory for the cloned repository.
    
    Raises:
        GitCloneError: If the git clone command fails; the error message is converted to a sanitized, safe message.
    """
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, str(dest)],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        safe_msg = handle_subprocess_error(e)
        raise GitCloneError(safe_msg) from e


async def index_repo(repo_url: str) -> list[dict]:
    """
    Clone a Git repository into a temporary directory and produce chunk dictionaries for supported source files.
    
    Files are recursively scanned; the function skips non-files, files with extensions not in SUPPORTED_EXTENSIONS, hidden files or files inside hidden directories, files located in common vendor/build/test/docs/asset directories, and files larger than 100 KB. Files that cannot be read are skipped.
    
    Parameters:
        repo_url (str): URL of the git repository to clone.
    
    Returns:
        list[dict]: Chunk dictionaries produced by `chunk_file` for each indexed file.
    """
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