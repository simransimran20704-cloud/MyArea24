"""
MyArea24 — AI Guardrail & Safety Service
Enterprise-grade safety, PII protection, prompt injection defense, and response quality assurance.
Compliant with OWASP Top 10 for LLMs and Indian Digital Personal Data Protection (DPDP) Act 2023.
"""

import re
import time
from typing import Any, Dict, List, Optional, Tuple
from backend.app.core.logging import logger

# Maximum allowed query length (characters)
MAX_QUERY_LENGTH = 500
MIN_QUERY_LENGTH = 2

# Prompt injection and jailbreak heuristic patterns
INJECTION_PATTERNS = [
    r"(?i)\b(ignore|disregard|override|bypass)\s+(all\s+)?(previous|prior|above|safety|security)\s+(instructions|directives|rules|filters)\b",
    r"(?i)\b(system\s+prompt\s+override|prompt\s+override)\b",
    r"(?i)\byou\s+are\s+now\s+(DAN|unfiltered|jailbroken|unrestricted|an\s+evil|developer\s+mode|terminal)\b",
    r"(?i)\breveal\s+(all\s+|the\s+)?(internal\s+|system\s+|hidden\s+)?(api_keys?|api\s+keys?|secret|prompt|instructions|keys?)\b",
    r"(?i)\bprint\s+(the\s+)?(api_key|api_keys|secret|password|jwt_secret)\b",
    r"(?i)\bsystem\s*:\s*you\s+must\b",
    r"(?i)\bpretend\s+you\s+have\s+no\s+(rules|guidelines|safety)\b",
    r"(?i)\boutput\s+the\s+(entire|raw)\s+prompt\b",
]

# Sensitive Indian PII patterns (DPDP compliance)
PII_PATTERNS = {
    "aadhaar": (r"\b\d{4}\s?\d{4}\s?\d{4}\b", "[REDACTED_AADHAAR]"),
    "pan": (r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", "[REDACTED_PAN]"),
    "phone": (r"\b(?:\+91[\-\s]?)?[6-9]\d{9}\b", "[REDACTED_PHONE]"),
    "credit_card": (r"\b(?:\d{4}[\-\s]?){3}\d{4}\b", "[REDACTED_CARD]"),
    "email": (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[REDACTED_EMAIL]"),
}

# Unsafe/harmful content patterns
HARMFUL_PATTERNS = [
    r"(?i)\b(how\s+to\s+make|synthesize|manufacture)\s+(bomb|explosive|weapon|poison|drug)\b",
    r"(?i)\b(hack|ddos|exploit|bypass\s+security\s+of)\b",
    r"(?i)\b(suicide|self-harm|harm\s+myself)\b",
]


class AIGuardrailService:
    """
    Stateless guardrail engine protecting Saathi AI from adversarial attacks,
    PII leakage, and unsafe queries.
    """

    @staticmethod
    def sanitize_input(query: str) -> Tuple[bool, str, Optional[str]]:
        """
        Validates, sanitizes, and masks PII in user query.
        Returns: (is_safe: bool, sanitized_query: str, rejection_reason: Optional[str])
        """
        if not query or not isinstance(query, str):
            return False, "", "Query cannot be empty."

        clean = query.strip()
        if len(clean) < MIN_QUERY_LENGTH:
            return False, "", "Query is too short."

        if len(clean) > MAX_QUERY_LENGTH:
            clean = clean[:MAX_QUERY_LENGTH]

        # 1. Check for harmful/violent/illegal queries
        for pat in HARMFUL_PATTERNS:
            if re.search(pat, clean):
                logger.warning(f"[ai_guardrails] Blocked harmful query matching pattern: {pat}")
                return False, "", "Query violates safety policy. Please ask civic or neighbourhood related queries."

        # 2. Check for prompt injection & jailbreak attempts
        for pat in INJECTION_PATTERNS:
            if re.search(pat, clean):
                logger.warning(f"[ai_guardrails] Prompt injection attempt blocked: {clean}")
                return False, "", "Adversarial or prompt-override instructions are not permitted."

        # 3. Mask PII (Phone, Aadhaar, PAN, Cards, Emails) to protect citizen privacy
        masked_query = clean
        for pii_name, (pat, repl) in PII_PATTERNS.items():
            if re.search(pat, masked_query):
                masked_query = re.sub(pat, repl, masked_query)
                logger.info(f"[ai_guardrails] Redacted {pii_name} from user query.")

        return True, masked_query, None

    @staticmethod
    def validate_response(
        response_text: str,
        grounded_context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, str]:
        """
        Validates the generated AI response for quality, safety, and lack of internal leakage.
        """
        if not response_text or not response_text.strip():
            return False, "Empty AI response received."

        # Check for system key leaks
        leak_patterns = [
            r"AIzaSy[A-Za-z0-9_-]{33}",  # Google API key pattern
            r"myarea24_local_development_secret_key",
            r"JWT_SECRET",
            r"DATABASE_URL",
        ]
        for pat in leak_patterns:
            if re.search(pat, response_text):
                logger.error("[ai_guardrails] Critical: LLM attempted to leak secret credential!")
                return False, "Response contained prohibited internal system information."

        return True, response_text

    @staticmethod
    def estimate_gemini_cost(
        input_text: str,
        output_text: str,
        model_name: str = "gemini-flash",
    ) -> Dict[str, Any]:
        """
        Estimates token counts and costs based on official Google Gemini pricing.
        Gemini 1.5/2.0 Flash:
          - Input: $0.075 / 1M tokens (~₹0.0062 / 1k tokens)
          - Output: $0.30 / 1M tokens (~₹0.025 / 1k tokens)
        """
        # Character-to-token heuristic (~4 chars per token)
        in_tokens = max(1, len(input_text) // 4)
        out_tokens = max(1, len(output_text) // 4)

        # In INR (USD 1 = ~₹85)
        in_cost_inr = (in_tokens / 1_000_000) * 0.075 * 85.0
        out_cost_inr = (out_tokens / 1_000_000) * 0.30 * 85.0
        total_cost_inr = in_cost_inr + out_cost_inr

        return {
            "model": model_name,
            "input_tokens": in_tokens,
            "output_tokens": out_tokens,
            "total_tokens": in_tokens + out_tokens,
            "estimated_cost_inr": round(total_cost_inr, 6),
        }
