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
import re
import uuid
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


def extract_text_tool_calls(text: str) -> tuple[str, list[ToolCallResult]]:
    """Extract pseudo-XML or JSON tool calls from LLM text and strip them from the user-visible output."""
    tool_calls: list[ToolCallResult] = []
    if not text:
        return text or "", tool_calls

    xml_pattern = re.compile(
        r"<tool_call>\s*(?:<function=([^\s>]+)>|</function>|[\s\S])*?</tool_call>",
        re.DOTALL | re.IGNORECASE,
    )
    inner_fn_pattern = re.compile(
        r"<function=([^\s>]+)>(.*?)</function>|<function=([^\s>]+)\s*/>|<function=([^\s>]+)>",
        re.DOTALL | re.IGNORECASE,
    )

    cleaned_text = text
    matches = list(xml_pattern.finditer(text))
    for m in matches:
        block = m.group(0)
        cleaned_text = cleaned_text.replace(block, "")
        for fn_m in inner_fn_pattern.finditer(block):
            fn_name = fn_m.group(1) or fn_m.group(3) or fn_m.group(4)
            if not fn_name:
                continue
            body = (fn_m.group(2) or "").strip()
            args: dict[str, Any] = {}
            if body:
                try:
                    args = json.loads(body)
                except Exception:
                    for kv in re.finditer(r'(\w+)=(?:"([^"]*)"|\'([^\']*)\'|(\S+))', body):
                        k = kv.group(1)
                        v = kv.group(2) or kv.group(3) or kv.group(4)
                        args[k] = v
            tool_calls.append(
                ToolCallResult(id=f"tc_{uuid.uuid4().hex[:8]}", name=fn_name, arguments=args)
            )

    return cleaned_text.strip(), tool_calls


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

            self._client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
                timeout=30.0,
                max_retries=2,
            )
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
                normalized_tools = []
                for t in tools:
                    if not isinstance(t, dict):
                        continue
                    if t.get("type") == "mcp":
                        normalized_tools.append(t)
                    elif t.get("type") == "function" and "function" in t:
                        normalized_tools.append(t)
                    elif "name" in t:
                        normalized_tools.append(
                            {
                                "type": "function",
                                "function": {
                                    "name": t["name"],
                                    "description": t.get("description", ""),
                                    "parameters": t.get("parameters", {}),
                                },
                            }
                        )
                    else:
                        normalized_tools.append(t)
                kwargs["tools"] = normalized_tools

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

            raw_content = msg.content or ""
            cleaned_content, text_calls = extract_text_tool_calls(raw_content)
            if text_calls:
                tool_calls.extend(text_calls)

            if tools:
                return LLMResponse(content=cleaned_content, tool_calls=tool_calls)
            return cleaned_content
        except Exception as exc:
            logger.error("Apinex completion error: %s", exc)
            raise


class GoogleGeminiProvider(LLMProvider):
    """Provider for Google Gemini models via google-adk or standard SDK."""

    def __init__(self, api_key: str | None = None, default_model: str = "gemini-3.8-flash") -> None:
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
        req_model = model or self.default_model
        # Map retired 2.x models to modern 3.8/current models
        if "2.5" in req_model or "2.0" in req_model or "3.5" in req_model:
            target_model = "gemini-3.8-flash"
        else:
            target_model = req_model

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)
            config_kwargs: dict[str, Any] = {
                "max_output_tokens": max_tokens,
                "temperature": temperature,
            }
            if system_instruction:
                config_kwargs["system_instruction"] = system_instruction

            if tools:
                fds = []
                for t in tools:
                    fn = t.get("function", t)
                    if isinstance(fn, dict) and "name" in fn:
                        fds.append(
                            types.FunctionDeclaration(
                                name=fn["name"],
                                description=fn.get("description", ""),
                                parameters=fn.get("parameters", {}),
                            )
                        )
                if fds:
                    config_kwargs["tools"] = [types.Tool(function_declarations=fds)]

            config = types.GenerateContentConfig(**config_kwargs)

            response = client.models.generate_content(
                model=target_model,
                contents=prompt,
                config=config,
            )

            tool_calls: list[ToolCallResult] = []
            if getattr(response, "function_calls", None):
                for fc in response.function_calls:
                    args = dict(fc.args) if fc.args else {}
                    tool_calls.append(
                        ToolCallResult(
                            id=f"gem_{uuid.uuid4().hex[:8]}", name=fc.name, arguments=args
                        )
                    )

            raw_text = response.text or ""
            cleaned_text, text_calls = extract_text_tool_calls(raw_text)
            if text_calls:
                tool_calls.extend(text_calls)

            if tools:
                return LLMResponse(content=cleaned_text, tool_calls=tool_calls)
            return cleaned_text
        except Exception as exc:
            logger.warning(
                "Google Gemini SDK direct generation unavailable with %s: %s", target_model, exc
            )
            if target_model != "gemini-3.8-flash":
                try:
                    from google import genai

                    client = genai.Client(api_key=self.api_key)
                    fb_resp = client.models.generate_content(
                        model="gemini-3.8-flash",
                        contents=prompt,
                    )
                    text = fb_resp.text or ""
                    cleaned, text_calls = extract_text_tool_calls(text)
                    if tools:
                        return LLMResponse(content=cleaned, tool_calls=text_calls)
                    return cleaned
                except Exception as fb_exc:
                    logger.warning("Google Gemini fallback error: %s", fb_exc)

            sim = f"Processed by {target_model}: {prompt}"
            if tools:
                return LLMResponse(content=sim, tool_calls=[])
            return sim


class LLMFactory:
    """Factory to resolve LLM provider based on requested model ID."""

    @staticmethod
    def get_provider_for_model(model_id: str | None = None) -> tuple[LLMProvider, str]:
        default_model = os.getenv("DEFAULT_MODEL", "free/gpt-6-luna")
        chosen = (model_id or default_model).strip()
        m = chosen.lower()

        # If user requests gemini models
        if "gemini" in m:
            target_model = (
                "gemini-3.8-flash"
                if ("2.5" in m or "2.0" in m or "3.5" in m)
                else (model_id or "gemini-3.8-flash")
            )
            provider = GoogleGeminiProvider(default_model=target_model)
            return provider, target_model

        # Default to APInex (free/gpt-6-luna or other apinex models)
        target_model = model_id or "free/gpt-6-luna"
        provider = ApinexProvider(default_model=target_model)
        return provider, target_model
