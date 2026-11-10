"""Extensible LLM Provider abstraction following SOLID principles.

Supports:
1. Apinex (Default: free/gpt-6-luna)
2. Google Gemini (Gemini 2.5 Flash, etc.)
3. Open-ended custom OpenAI-compatible providers.
"""

from __future__ import annotations

import json
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger("agent_runtime.llm_provider")


@dataclass
class ToolCallResult:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class LLMResponse:
    content: str
    tool_calls: list[ToolCallResult] = field(default_factory=list)


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


# Ensure env is loaded
_curr = Path(__file__).resolve().parent
for _p in [
    _curr / ".env",
    _curr.parent / ".env",
    _curr.parent.parent / ".env",
    Path.cwd() / ".env",
    Path.cwd() / "apps/agent-runtime/.env",
]:
    _load_env_file(_p)


class LLMProvider(ABC):
    """Abstract base class for model providers (Dependency Inversion & Open-Closed)."""

    @abstractmethod
    def generate(
        self,
        prompt: str,
        system_instruction: str | None = None,
        model: str | None = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        tools: list[dict[str, Any]] | None = None,
    ) -> str | LLMResponse:
        """Generate response text or tool calls from LLM."""
        pass


class ApinexProvider(LLMProvider):
    """Provider for APInex free models (OpenAI-compatible)."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://api.apinex.bond/v1",
        default_model: str = "free/gpt-6-luna",
    ) -> None:
        self.api_key = api_key or os.getenv("APINEX_API_KEY", "")
        self.base_url = base_url
        self.default_model = default_model
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    def generate(
        self,
        prompt: str,
        system_instruction: str | None = None,
        model: str | None = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        tools: list[dict[str, Any]] | None = None,
    ) -> str | LLMResponse:
        client = self._get_client()
        target_model = model or self.default_model

        messages: list[dict[str, str]] = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        try:
            kwargs: dict[str, Any] = {
                "model": target_model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
            if tools:
                kwargs["tools"] = tools

            res = client.chat.completions.create(**kwargs)
            choice = res.choices[0]
            msg = choice.message

            tool_calls: list[ToolCallResult] = []
            if getattr(msg, "tool_calls", None):
                for tc in msg.tool_calls:
                    fn_name = tc.function.name
                    try:
                        args = json.loads(tc.function.arguments) if tc.function.arguments else {}
                    except Exception:
                        args = {}
                    tool_calls.append(ToolCallResult(id=tc.id, name=fn_name, arguments=args))

            content = msg.content or ""
            if tools:
                return LLMResponse(content=content, tool_calls=tool_calls)
            return content
        except Exception as exc:
            logger.error("Apinex completion error: %s", exc)
            raise


class GoogleGeminiProvider(LLMProvider):
    """Provider for Google Gemini models via google-adk or standard SDK."""

    def __init__(self, api_key: str | None = None, default_model: str = "gemini-2.5-flash") -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.default_model = default_model

    def generate(
        self,
        prompt: str,
        system_instruction: str | None = None,
        model: str | None = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        tools: list[dict[str, Any]] | None = None,
    ) -> str | LLMResponse:
        # Fallback simulation or direct call
        target_model = model or self.default_model
        try:
            from google import genai

            client = genai.Client(api_key=self.api_key)
            config: dict[str, Any] = {"max_output_tokens": max_tokens, "temperature": temperature}
            if system_instruction:
                config["system_instruction"] = system_instruction
            response = client.models.generate_content(
                model=target_model,
                contents=prompt,
                config=config,
            )
            text = response.text or ""
            if tools:
                return LLMResponse(content=text, tool_calls=[])
            return text
        except Exception as exc:
            logger.warning("Google Gemini SDK direct generation unavailable: %s", exc)
            sim = f"Processed by {target_model}: {prompt}"
            if tools:
                return LLMResponse(content=sim, tool_calls=[])
            return sim
        except Exception as exc:
            logger.warning("Google Gemini SDK direct generation unavailable: %s", exc)
            return f"Processed by {target_model}: {prompt}"


class LLMFactory:
    """Factory to resolve LLM provider based on requested model ID."""

    @staticmethod
    def get_provider_for_model(model_id: str | None = None) -> tuple[LLMProvider, str]:
        m = (model_id or "free/gpt-6-luna").strip().lower()

        # If user requests gemini models
        if "gemini" in m:
            provider = GoogleGeminiProvider(default_model=model_id or "gemini-2.5-flash")
            return provider, model_id or "gemini-2.5-flash"

        # Default to APInex (free/gpt-6-luna or other apinex models)
        provider = ApinexProvider(default_model=model_id or "free/gpt-6-luna")
        return provider, model_id or "free/gpt-6-luna"
