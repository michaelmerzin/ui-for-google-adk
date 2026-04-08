# ADK Agent

Minimal Google ADK agent powered by Claude via LiteLLM.

## Setup

```powershell
cd adk_agent

# Create and activate venv
python -m venv .venv
.venv\Scripts\activate

# Install deps
pip install -r requirements.txt

# Configure
copy .env.example .env
notepad .env   # set your ANTHROPIC_API_KEY
```

## Run

```powershell
# Option A — use the start script (handles everything)
start.bat

# Option B — manual
.venv\Scripts\activate
adk web --port 8001
```

The ADK server starts on **http://localhost:8001**.

## Connect to the UI

In the UI Configuration modal (admin only), set:
- **ADK API URL** → `http://localhost:8001`
- **ADK Agent Name** → `root_agent`

Also update `backend/.env`:
```env
ADK_BASE_URL=http://localhost:8001
ADK_AGENT_NAME=root_agent
```

Then restart uvicorn.

## Adding tools

Edit `tools.py` — add any Python function with a docstring and type hints.
ADK automatically exposes it as a tool to the agent.

```python
def my_tool(query: str) -> dict:
    """Describe what this tool does.
    
    Args:
        query (str): The input query.
    
    Returns:
        dict: The result.
    """
    return {"status": "success", "result": "..."}

# Add to ALL_TOOLS list at the bottom of tools.py
ALL_TOOLS = [..., my_tool]
```

## File structure

```
adk_agent/
├── agent.py        # Root agent definition — ADK entry point
├── tools.py        # All tool functions
├── .env.example    # Environment template
├── requirements.txt
└── start.bat       # Windows start script
```
