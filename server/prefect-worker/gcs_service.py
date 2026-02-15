"""
Google Cloud Storage Service for the Prefect Worker
Downloads workflow data (Excel/CSV/PDF) from GCS buckets
"""
import os
import json
from typing import Optional, Dict, Any

import config


class GCSService:
    """Handles downloading workflow data from Google Cloud Storage"""

    def __init__(self):
        self.storage_client = None
        self.bucket = None
        self.bucket_name = os.getenv("GCS_BUCKET_NAME", "mvp_albert")
        self.initialized = False

    def init(self) -> bool:
        """Initialize GCS connection. Returns True if successful."""
        if self.initialized:
            return True

        try:
            from google.cloud import storage

            credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            project_id = os.getenv("GCP_PROJECT_ID")

            if not credentials_path:
                print("[GCS-Python] GOOGLE_APPLICATION_CREDENTIALS not set - GCS disabled")
                return False

            self.storage_client = storage.Client(project=project_id)
            self.bucket = self.storage_client.bucket(self.bucket_name)

            # Test connection
            if not self.bucket.exists():
                print(f"[GCS-Python] Bucket '{self.bucket_name}' does not exist")
                return False

            self.initialized = True
            print(f"[GCS-Python] Connected to bucket: {self.bucket_name}")
            return True

        except ImportError:
            print("[GCS-Python] google-cloud-storage not installed - GCS disabled")
            return False
        except Exception as e:
            print(f"[GCS-Python] Init error: {e}")
            return False

    def is_available(self) -> bool:
        """Check if GCS is available"""
        return self.initialized

    def download_workflow_data(self, gcs_path: str) -> Dict[str, Any]:
        """
        Download workflow data from GCS
        
        Args:
            gcs_path: Path in GCS bucket (e.g. 'workflows/{wfId}/{nodeId}/timestamp_file.json')
            
        Returns:
            dict with keys: success, data, error, row_count
        """
        if not self.initialized:
            if not self.init():
                return {"success": False, "error": "GCS not initialized"}

        try:
            blob = self.bucket.blob(gcs_path)

            if not blob.exists():
                return {"success": False, "error": f"File not found in GCS: {gcs_path}"}

            contents = blob.download_as_text()
            data = json.loads(contents)

            row_count = len(data) if isinstance(data, list) else 1
            print(f"[GCS-Python] Downloaded {gcs_path} ({len(contents)} bytes)")

            return {
                "success": True,
                "data": data,
                "row_count": row_count
            }

        except Exception as e:
            print(f"[GCS-Python] Download error: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
gcs_service = GCSService()

