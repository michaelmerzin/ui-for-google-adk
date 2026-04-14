"""
Root agent — powered by Claude via LiteLLM.

ADK looks for `root_agent` variable in this file.
Run from the parent folder (adk_agent/) with: adk web --port 8001
"""

import os
from dotenv import load_dotenv

from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm

from .tools import ALL_TOOLS

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")

INSTRUCTION = """You are a helpful, precise AI assistant powered by Claude.

You have access to the following tools:
- get_current_time: Get the current date and time
- calculate: Evaluate mathematical expressions
- search_knowledge_base: Search for information
- format_as_table: Format data as a markdown table
- remember_note: Save a short note into ADK session state
- read_saved_note: Read the previously saved note from ADK session state

Guidelines:
- Always use tools when they would help answer the question more accurately
- When returning data that could be tabular (lists of items with properties),
  use format_as_table to present it clearly
- When asked about locations or coordinates, include them in your response
  in the format: "Name: lat, lng" so they can be shown on a map
- If the user asks you to remember something for this session, use remember_note
- If the user asks what is stored in session state, use read_saved_note when helpful
- Be concise and direct
- If you are unsure about something, say so clearly
"""

root_agent = Agent(
    name="root_agent",
    model=LiteLlm(model=f"anthropic/{CLAUDE_MODEL}"),
    description="A helpful general-purpose assistant powered by Claude.",
    instruction=INSTRUCTION,
    tools=ALL_TOOLS,
)
