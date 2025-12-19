from pathlib import Path

from langchain_text_splitters import Language, RecursiveCharacterTextSplitter

# Map file extensions to LangChain languages
LANGUAGE_MAP: dict[str, Language] = {
    # Python
    ".py": Language.PYTHON,
    # JavaScript/TypeScript
    ".js": Language.JS,
    ".jsx": Language.JS,
    ".ts": Language.TS,
    ".tsx": Language.TS,
    # Go
    ".go": Language.GO,
    # Rust
    ".rs": Language.RUST,
    # Java/Kotlin
    ".java": Language.JAVA,
    ".kt": Language.KOTLIN,
    # C/C++
    ".c": Language.C,
    ".h": Language.C,
    ".cpp": Language.CPP,
    ".hpp": Language.CPP,
    ".cc": Language.CPP,
    # C#
    ".cs": Language.CSHARP,
    # Ruby
    ".rb": Language.RUBY,
    # PHP
    ".php": Language.PHP,
    # Swift
    ".swift": Language.SWIFT,
    # Scala
    ".scala": Language.SCALA,
    # Markdown (for docs)
    ".md": Language.MARKDOWN,
}

# Extensions to index (all supported languages)
SUPPORTED_EXTENSIONS = set(LANGUAGE_MAP.keys())


def chunk_file(content: str, file_path: str) -> list[dict]:
    """Chunk a source file using language-aware splitting."""
    ext = Path(file_path).suffix.lower()
    language = LANGUAGE_MAP.get(ext)

    if not language:
        return []

    splitter = RecursiveCharacterTextSplitter.from_language(
        language=language,
        chunk_size=2500,  # Larger chunks = fewer API calls
        chunk_overlap=150,
    )

    chunks = splitter.split_text(content)

    return [
        {
            "content": chunk,
            "file": file_path,
            "type": language.value,
            "name": f"chunk_{i}",
            "line": i,  # Using index as pseudo-line for uniqueness
        }
        for i, chunk in enumerate(chunks)
    ]
