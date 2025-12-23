"""Error handling utilities for safe client responses.

This module provides centralized error handling to prevent leaking sensitive
information (API keys, database URLs, file paths) to clients while logging
full details server-side for debugging.
"""

import logging
import re
import subprocess
from typing import Any

logger = logging.getLogger("nori")

# Patterns that indicate sensitive data in error messages
SENSITIVE_PATTERNS = [
    r"sk-[a-zA-Z0-9-_]+",  # Anthropic API keys
    r"sk-ant-[a-zA-Z0-9-_]+",  # Anthropic API keys (new format)
    r"voyage-[a-zA-Z0-9-_]+",  # Voyage API keys
    r"[a-zA-Z0-9_-]*api[_-]?key[a-zA-Z0-9_-]*=[^\s&]+",  # Generic API keys in URLs
    r"postgresql://[^\s]+",  # Database URLs
    r"postgres://[^\s]+",  # Database URLs
    r"https?://[^\s]*:[^\s@]*@",  # URLs with credentials
    r"/Users/[^\s]+",  # macOS file paths
    r"/home/[^\s]+",  # Linux home paths
    r"/tmp/[^\s]+",  # Temp paths
    r"C:\\[^\s]+",  # Windows paths
]

# Map exception type patterns to safe client messages
ERROR_MESSAGES: dict[str, str] = {
    # Anthropic errors
    "AuthenticationError": "AI service authentication failed. Please check your API key.",
    "RateLimitError": "AI service rate limit exceeded. Please try again in a moment.",
    "APIConnectionError": "Unable to connect to AI service. Please try again.",
    "BadRequestError": "Invalid request to AI service.",
    "APIError": "AI service error. Please try again.",
    # Cohere errors
    "CohereAPIError": "Reranking service error. Results may be less relevant.",
    "CohereConnectionError": "Unable to connect to reranking service.",
    # VoyageAI / Chroma errors
    "ChromaError": "Vector search service error. Please try again.",
    "VectorstoreError": "Vector search service unavailable. Please try again.",
    # Git/subprocess errors
    "CalledProcessError": "Failed to clone repository. Please check the URL.",
    "GitCloneError": "Failed to clone repository. Please check the URL.",
    # Database errors
    "PostgresError": "Database error. Please try again.",
    "InterfaceError": "Database connection error. Please try again.",
    "PoolError": "Database connection error. Please try again.",
    # Network errors
    "ConnectionError": "Service connection error. Please try again.",
    "TimeoutError": "Request timed out. Please try again.",
    "ConnectTimeout": "Connection timed out. Please try again.",
}

DEFAULT_ERROR_MESSAGE = "An unexpected error occurred. Please try again."


def sanitize_error_message(error: Exception) -> str:
    """Remove sensitive data from error message for logging context.

    Note: This is for sanitized logging, NOT for client display.
    Use get_safe_error_message() for client-facing messages.
    """
    message = str(error)

    for pattern in SENSITIVE_PATTERNS:
        message = re.sub(pattern, "[REDACTED]", message, flags=re.IGNORECASE)

    return message


def get_safe_error_message(error: Exception) -> str:
    """Get a safe, generic error message for client display.

    Never returns the actual exception message - only predefined safe messages.
    """
    error_type = type(error).__name__

    # Check for known error types
    for key, message in ERROR_MESSAGES.items():
        if key.lower() in error_type.lower():
            return message

    # Check parent classes
    for parent in type(error).__mro__:
        parent_name = parent.__name__
        for key, message in ERROR_MESSAGES.items():
            if key.lower() in parent_name.lower():
                return message

    return DEFAULT_ERROR_MESSAGE


def log_error(
    error: Exception,
    context: str,
    extra: dict[str, Any] | None = None,
) -> str:
    """Log full error details server-side and return safe client message.

    Args:
        error: The exception that occurred
        context: Description of where the error occurred (e.g., "llm_init", "repo_indexing")
        extra: Additional context to include in the log

    Returns:
        Safe error message for client display (never contains sensitive data)
    """
    logger.error(
        f"[{context}] {type(error).__name__}: {sanitize_error_message(error)}",
        exc_info=True,
        extra={
            "error_type": type(error).__name__,
            "context": context,
            **(extra or {}),
        },
    )

    return get_safe_error_message(error)


def handle_subprocess_error(error: subprocess.CalledProcessError) -> str:
    """Handle subprocess errors safely without leaking command output.

    Args:
        error: The CalledProcessError from subprocess.run

    Returns:
        Safe error message for client display
    """
    # Log full details server-side (sanitized)
    stderr = error.stderr or ""
    stdout = error.stdout or ""

    # Sanitize the output before logging
    for pattern in SENSITIVE_PATTERNS:
        stderr = re.sub(pattern, "[REDACTED]", stderr, flags=re.IGNORECASE)
        stdout = re.sub(pattern, "[REDACTED]", stdout, flags=re.IGNORECASE)

    logger.error(
        f"Subprocess failed: returncode={error.returncode}",
        extra={
            "stdout": stdout[:1000] if stdout else None,  # Limit log size
            "stderr": stderr[:1000] if stderr else None,
        },
    )

    # Return safe message based on command type
    cmd_str = " ".join(str(c) for c in error.cmd) if error.cmd else ""
    if "clone" in cmd_str:
        return "Failed to clone repository. Please check the URL is correct and the repository is public."

    return "Repository operation failed. Please try again."


class GitCloneError(Exception):
    """Raised when git clone fails. Contains only safe message."""

    def __init__(self, safe_message: str):
        self.safe_message = safe_message
        super().__init__(safe_message)


class VectorstoreError(Exception):
    """Raised when vectorstore operations fail. Contains only safe message."""

    def __init__(self, safe_message: str = "Vector search service unavailable"):
        self.safe_message = safe_message
        super().__init__(safe_message)
