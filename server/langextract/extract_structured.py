#!/usr/bin/env python3
"""
Best-effort structured extraction script.

If langextract is installed, it returns lightweight structured output.
If not installed, exits with non-zero so the Node fallback is used.
"""

import json
import sys
from datetime import datetime, timezone


def _utc_now():
    return datetime.now(timezone.utc).isoformat()


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw or "{}")
    text = (payload.get("text") or "").strip()

    if not text:
        print(json.dumps({"extractions": [], "stats": {"sourceChars": 0}}))
        return

    try:
        import langextract as lx  # type: ignore
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"langextract_not_available: {exc}\n")
        sys.exit(2)

    prompt = (
        "Extract process parameters, limits, risks and actions from the text. "
        "Keep extraction_text verbatim and include useful attributes."
    )

    examples = [
        lx.data.ExampleData(
            text="Presion de cabezal 182 bar. DeltaE maximo 1.2. Activar plan de contingencia.",
            extractions=[
                lx.data.Extraction(
                    extraction_class="process_parameter",
                    extraction_text="Presion de cabezal 182 bar",
                    attributes={"parameter": "pressure", "value": 182, "unit": "bar"},
                ),
                lx.data.Extraction(
                    extraction_class="quality_limit",
                    extraction_text="DeltaE maximo 1.2",
                    attributes={"parameter": "deltaE", "max": 1.2},
                ),
                lx.data.Extraction(
                    extraction_class="recommended_action",
                    extraction_text="Activar plan de contingencia",
                    attributes={"priority": "high"},
                ),
            ],
        )
    ]

    result = lx.extract(
        text_or_documents=text,
        prompt_description=prompt,
        examples=examples,
        model_id="gemini-2.5-flash",
    )

    extracted_items = []
    for item in getattr(result, "extractions", []) or []:
        extracted_items.append(
            {
                "extraction_class": getattr(item, "extraction_class", "unknown"),
                "extraction_text": getattr(item, "extraction_text", ""),
                "attributes": getattr(item, "attributes", {}) or {},
            }
        )

    output = {
        "generatedAt": _utc_now(),
        "extractions": extracted_items,
        "stats": {
            "sourceChars": len(text),
            "extractedItems": len(extracted_items),
        },
    }
    print(json.dumps(output, ensure_ascii=True))


if __name__ == "__main__":
    main()
