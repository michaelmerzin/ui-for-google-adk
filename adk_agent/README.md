# ADK Agent

Minimal Google ADK agent powered by Claude via LiteLLM.

## Setup

```powershell
cd adk_agent

python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
notepad .env
```

Set your `ANTHROPIC_API_KEY` in `.env`.

## Run

```powershell
# Option A
start.bat

# Option B
.venv\Scripts\activate
adk web --port 8001
```

The ADK server starts on `http://localhost:8001`.

## Connect To The UI

Set these in the UI or backend config:

- `ADK API URL`: `http://localhost:8001`
- `ADK Agent Name`: `root_agent`

And in `backend/.env`:

```env
ADK_BASE_URL=http://localhost:8001
ADK_AGENT_NAME=root_agent
```

Then restart the backend.

## Included Tools

- `get_current_time`
- `calculate`
- `search_knowledge_base`
- `format_as_table`
- `remember_note`
- `read_saved_note`

## Toy State Tool

This repo now includes a tiny demo for ADK session state:

- `remember_note(note, tool_context)` writes the note into session state as `user:last_note`
- `read_saved_note(tool_context)` reads that value back

Try these prompts in the UI:

- `Remember this for the session: my favorite color is green`
- `What note do you have saved for this session?`

After running it, open the State Inspector and you should see:

- `user:last_note`
- `temp:last_note_saved_at`

## Adding Tools

Edit `root_agent/tools.py` and add any Python function with a docstring and type hints. Then add it to `ALL_TOOLS`.

```python
def my_tool(query: str) -> dict:
    """Describe what this tool does."""
    return {"status": "success", "result": "..."}

ALL_TOOLS = [..., my_tool]
```

## File Structure

```text
adk_agent/
|-- root_agent/
|   |-- agent.py
|   |-- tools.py
|   `-- __init__.py
|-- .env.example
|-- requirements.txt
`-- start.bat
```
