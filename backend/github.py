import tempfile
import subprocess
from pathlib import Path

from chunks import chunk_python_file


def clone_repo(repo_url, dest: Path):
    subprocess.run(["git", "clone", "--depth", "1", repo_url, str(dest)], check=True)


async def index_repo(repo_url: str):
    all_chunks = []
    with tempfile.TemporaryDirectory() as tmpdir:
        dest = Path(tmpdir)
        clone_repo(repo_url, dest)
        for file in dest.rglob("*.py"):
            content = file.read_text()
            relative_path = str(file.relative_to(dest))
            chunks = chunk_python_file(content, relative_path)
            all_chunks.extend(chunks)
    return all_chunks
