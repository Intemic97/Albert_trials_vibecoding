# LangExtract Integration (Knowledge Base)

This folder contains the integration of [Google LangExtract](https://github.com/google/langextract) for structured extraction from Knowledge Base documents and **converting documents to table**.

## What was added

- Node service: `server/services/langExtractService.js`
- Python bridge script: `server/langextract/extract_structured.py` (uses `langextract` library)
- API endpoint:
  - `POST /api/knowledge/documents/:id/extract-structured`
- UI in Knowledge Base:
  - **"Extract structured data"** button per document (runs LangExtract/heuristic)
  - **"Convert to table"** (table icon): opens a modal with extractions as a data table and **Export CSV**

## Endpoint behavior

The endpoint reads `knowledge_documents.extractedText` and stores structured output in:

- `knowledge_documents.metadata.structuredExtraction`
- `knowledge_documents.metadata.structuredExtractionUpdatedAt`

Request body (optional):

```json
{
  "mode": "auto",
  "maxChars": 12000,
  "force": false
}
```

- `mode=auto`: tries LangExtract and falls back to heuristic extraction.
- `mode=langextract`: uses Python LangExtract path only.
- `mode=heuristic`: uses server-side heuristic extractor only.
- `force=true`: recompute even if there is already cached extraction.

## LangExtract dependency

If Python package `langextract` is installed and configured, `mode=auto` can use it.
If not installed, extraction still works via fallback heuristic logic.

Install (in your Python environment):

```bash
pip install langextract
```

If you plan to use cloud-hosted models, configure `LANGEXTRACT_API_KEY` as described in:

- https://github.com/google/langextract

## Current scope

This is an ingestion enrichment feature for Knowledge Base documents.
It does not replace existing search or import APIs; it adds structured metadata to documents after upload.
