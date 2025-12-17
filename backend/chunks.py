import ast


def chunk_python_file(content: str, file_path: str) -> list[dict]:
    chunks = []

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return [{"content": content, "file": file_path, "type": "file"}]

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            chunk = ast.get_source_segment(content, node)
            chunks.append(
                {
                    "content": chunk,
                    "file": file_path,
                    "type": "function",
                    "name": node.name,
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
                }
            )

    if ast.get_docstring(tree):
        chunks.append(
            {
                "content": ast.get_docstring(tree),
                "file": file_path,
                "type": "docstring",
                "name": "module",
            }
        )

    return chunks
