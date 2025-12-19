import ast


def chunk_python_file(content: str, file_path: str) -> list[dict]:
    chunks = []

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return [{"content": content, "file": file_path, "type": "file", "name": "file", "line": 1}]

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            chunk = ast.get_source_segment(content, node)
            chunks.append(
                {
                    "content": chunk,
                    "file": file_path,
                    "type": "function",
                    "name": node.name,
                    "line": node.lineno,
                }
            )

        elif isinstance(node, ast.ClassDef):
            chunk = ast.get_source_segment(content, node)
            chunks.append(
                {
                    "content": chunk,
                    "file": file_path,
                    "type": "class",
                    "name": node.name,
                    "line": node.lineno,
                }
            )

    if ast.get_docstring(tree):
        chunks.append(
            {
                "content": ast.get_docstring(tree),
                "file": file_path,
                "type": "docstring",
                "name": "module",
                "line": 1,
            }
        )

    return chunks
