"""LLM integration.

These functions wrap an LLM provider (OpenAI-compatible API). When no
provider key is configured they fall back to deterministic template
output so the platform works end-to-end offline / in demo mode.

Set OPENAI_API_KEY (or LLM_API_KEY) + LLM_BASE_URL in the environment
to enable real generation.
"""
from __future__ import annotations

import os
from typing import Any

try:
    from dotenv import load_dotenv

    load_dotenv()  # surface backend/.env values into os.environ

except Exception:  # pragma: no cover
    pass

BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
API_KEY = os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY", "")
MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# Gemini (Google) — preferred when GEMINI_API_KEY is set
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

try:
    import httpx

    HAVE_HTTPX = True
except Exception:  # pragma: no cover
    HAVE_HTTPX = False


def _chat(messages: list[dict[str, str]]) -> str:
    if not HAVE_HTTPX:
        raise RuntimeError("LLM not configured")
    system = next((m["content"] for m in messages if m["role"] == "system"), "")
    user_text = "\n".join(m["content"] for m in messages if m["role"] == "user")
    prompt = f"{system}\n\n{user_text}" if system else user_text

    # 1) Gemini (Google)
    if GEMINI_API_KEY:
        try:
            resp = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                params={"key": GEMINI_API_KEY},
                json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.3}},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as exc:
            print(f"[llm] gemini failed: {exc}")

    # 2) OpenAI-compatible
    if API_KEY:
        resp = httpx.post(
            f"{BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}"},
            json={"model": MODEL, "messages": messages, "temperature": 0.3},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    raise RuntimeError("LLM not configured")


def coach_message(report: dict[str, Any], previous: dict[str, Any] | None = None) -> str:
    """Natural-language explanation of the latest report for the patient."""
    try:
        return _chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You are a compassionate AI health coach for a neurological screening app. "
                        "Explain results in plain language, compare against the previous screening, "
                        "never diagnose, and always recommend consulting a neurologist for concerns. "
                        "Keep it under 120 words."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Latest report: {report}\n"
                        f"Previous report: {previous or 'none'}\n"
                        "Write the coaching message."
                    ),
                },
            ]
        )
    except Exception:
        # deterministic fallback
        worst = sorted(report.get("domain_scores", {}).items(), key=lambda kv: kv[1])[:1]
        if worst:
            domain, score = worst[0]
            return (
                f"Your {domain} score is {score}/100 this week"
                + (f", down from {previous['domain_scores'].get(domain, '?')} last time." if previous else ".")
                + " Consider discussing this change with your neurologist and repeating the screening next week."
            )
        return "This week's screening shows no concerning changes. Keep up your monitoring schedule."


def doctor_summary(report: dict[str, Any]) -> str:
    """Concise clinical summary for the doctor portal."""
    try:
        return _chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You are a neurology assistant. Summarize the patient's digital screening "
                        "report for a neurologist in 3–4 objective sentences, noting changed biomarkers "
                        "and recommending next steps. Do not diagnose."
                    ),
                },
                {"role": "user", "content": f"Report: {report}"},
            ]
        )
    except Exception:
        domains = sorted(report.get("domain_scores", {}).items(), key=lambda kv: kv[1])
        weakest = ", ".join(f"{d} ({s}/100)" for d, s in domains[:2])
        return (
            f"Digital screening shows overall score {report.get('overall')}/100 "
            f"({report.get('risk')} risk). Weakest domains: {weakest}. "
            "Recommend clinical correlation and repeat screening in 2–4 weeks."
        )


def translate(text: str, target_lang: str) -> str:
    """Translate a report paragraph into a supported language."""
    if target_lang == "en":
        return text
    try:
        return _chat(
            [
                {"role": "system", "content": f"Translate the following to {target_lang}. Keep medical terms accurate."},
                {"role": "user", "content": text},
            ]
        )
    except Exception:
        return text  # fall back to English
