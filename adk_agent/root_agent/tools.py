"""
Tools available to the root agent.
Add your own tools here — each function becomes a callable tool for the agent.
"""

import json
from datetime import datetime


def get_current_time() -> dict:
    """Returns the current date and time.

    Returns:
        dict: Current datetime information.
    """
    now = datetime.now()
    return {
        "status": "success",
        "datetime": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "day_of_week": now.strftime("%A"),
    }


def calculate(expression: str) -> dict:
    """Safely evaluates a mathematical expression.

    Args:
        expression (str): A math expression, e.g. "2 + 2", "sqrt(16)", "100 * 0.15"

    Returns:
        dict: Result of the calculation.
    """
    import math

    allowed_names = {k: v for k, v in math.__dict__.items() if not k.startswith("_")}
    allowed_names.update({"abs": abs, "round": round, "min": min, "max": max})

    try:
        result = eval(expression, {"__builtins__": {}}, allowed_names)
        return {"status": "success", "expression": expression, "result": result}
    except Exception as e:
        return {"status": "error", "expression": expression, "error": str(e)}


def search_knowledge_base(query: str) -> dict:
    """Searches a knowledge base for relevant information.
    Replace this stub with a real vector DB, SQL query, or API call.

    Args:
        query (str): The search query.

    Returns:
        dict: Search results.
    """
    return {
        "status": "success",
        "query": query,
        "results": [
            {
                "title": "Example result",
                "content": f"This is a stub result for query: '{query}'. "
                           "Replace search_knowledge_base() in tools.py with your real data source.",
                "relevance": 0.95,
            }
        ],
        "note": "This is a stub. Connect your real data source in root_agent/tools.py",
    }


def format_as_table(data: str) -> dict:
    """Formats JSON data as a markdown table.

    Args:
        data (str): JSON string containing a list of objects.

    Returns:
        dict: Markdown table string.
    """
    try:
        rows = json.loads(data)
        if not rows or not isinstance(rows, list):
            return {"status": "error", "error": "Expected a JSON array"}

        headers = list(rows[0].keys())
        header_row = "| " + " | ".join(headers) + " |"
        separator = "| " + " | ".join(["---"] * len(headers)) + " |"
        data_rows = [
            "| " + " | ".join(str(row.get(h, "")) for h in headers) + " |"
            for row in rows
        ]
        table = "\n".join([header_row, separator] + data_rows)
        return {"status": "success", "table": table, "row_count": len(rows)}
    except json.JSONDecodeError as e:
        return {"status": "error", "error": f"Invalid JSON: {e}"}


ALL_TOOLS = [
    get_current_time,
    calculate,
    search_knowledge_base,
    format_as_table,
]
"""
Tools available to the root agent.
Add your own tools here — each function becomes a callable tool for the agent.
"""

import json
from datetime import datetime


def get_current_time() -> dict:
    """Returns the current date and time.

    Returns:
        dict: Current datetime information.
    """
    now = datetime.now()
    return {
        "status": "success",
        "datetime": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "day_of_week": now.strftime("%A"),
    }


def calculate(expression: str) -> dict:
    """Safely evaluates a mathematical expression.

    Args:
        expression (str): A math expression, e.g. "2 + 2", "sqrt(16)", "100 * 0.15"

    Returns:
        dict: Result of the calculation.
    """
    import math

    allowed_names = {k: v for k, v in math.__dict__.items() if not k.startswith("_")}
    allowed_names.update({"abs": abs, "round": round, "min": min, "max": max})

    try:
        result = eval(expression, {"__builtins__": {}}, allowed_names)
        return {"status": "success", "expression": expression, "result": result}
    except Exception as e:
        return {"status": "error", "expression": expression, "error": str(e)}


def search_knowledge_base(query: str) -> dict:
    """Searches a knowledge base for relevant information.
    Replace this stub with a real vector DB, SQL query, or API call.

    Args:
        query (str): The search query.

    Returns:
        dict: Search results.
    """
    return {
        "status": "success",
        "query": query,
        "results": [
            {
                "title": "Example result",
                "content": f"This is a stub result for query: '{query}'. "
                           "Replace search_knowledge_base() in tools.py with your real data source.",
                "relevance": 0.95,
            }
        ],
        "note": "This is a stub. Connect your real data source in root_agent/tools.py",
    }


def format_as_table(data: str) -> dict:
    """Formats JSON data as a markdown table.

    Args:
        data (str): JSON string containing a list of objects.

    Returns:
        dict: Markdown table string.
    """
    try:
        rows = json.loads(data)
        if not rows or not isinstance(rows, list):
            return {"status": "error", "error": "Expected a JSON array"}

        headers = list(rows[0].keys())
        header_row = "| " + " | ".join(headers) + " |"
        separator = "| " + " | ".join(["---"] * len(headers)) + " |"
        data_rows = [
            "| " + " | ".join(str(row.get(h, "")) for h in headers) + " |"
            for row in rows
        ]
        table = "\n".join([header_row, separator] + data_rows)
        return {"status": "success", "table": table, "row_count": len(rows)}
    except json.JSONDecodeError as e:
        return {"status": "error", "error": f"Invalid JSON: {e}"}


ALL_TOOLS = [
    get_current_time,
    calculate,
    search_knowledge_base,
    format_as_table,
]