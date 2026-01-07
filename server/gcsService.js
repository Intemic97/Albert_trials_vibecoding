/**
 * Google Cloud Storage Service
 * Handles uploading and downloading workflow data to/from GCS
 */

const { Storage } = require('@google-cloud/storage');
const path = require('path');

class GCSService {
    constructor() {
        this.storage = null;
        this.bucket = null;
        this.bucketName = process.env.GCS_BUCKET_NAME || 'mvp_albert';
        this.initialized = false;
    }

    /**
     * Initialize GCS connection
     */
    async init() {
        if (this.initialized) return true;

        try {
            // Check for credentials
            const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            const projectId = process.env.GCP_PROJECT_ID;

            if (!keyFilename) {
                console.warn('[GCS] GOOGLE_APPLICATION_CREDENTIALS not set - GCS disabled');
                return false;
            }

            this.storage = new Storage({
                keyFilename,
                projectId
            });

            this.bucket = this.storage.bucket(this.bucketName);

            // Test connection
            const [exists] = await this.bucket.exists();
            if (!exists) {
                console.error(`[GCS] Bucket '${this.bucketName}' does not exist`);
                return false;
            }

            this.initialized = true;
            console.log(`[GCS] Connected to bucket: ${this.bucketName}`);
            return true;

        } catch (error) {
            console.error('[GCS] Init error:', error.message);
            return false;
        }
    }

    /**
     * Check if GCS is available
     */
    isAvailable() {
        return this.initialized;
    }

    /**
     * Upload workflow data to GCS
     * @param {string} workflowId - Workflow ID
     * @param {string} nodeId - Node ID
     * @param {object} data - Data to upload (will be JSON stringified)
     * @param {string} originalFileName - Original file name for reference
     * @returns {object} { success, gcsPath, error }
     */
    async uploadWorkflowData(workflowId, nodeId, data, originalFileName = 'data') {
        if (!this.initialized) {
            await this.init();
            if (!this.initialized) {
                return { success: false, error: 'GCS not initialized' };
            }
        }

        try {
            const timestamp = Date.now();
            const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const gcsPath = `workflows/${workflowId}/${nodeId}/${timestamp}_${safeName}.json`;
            
            const file = this.bucket.file(gcsPath);
            
            const jsonData = JSON.stringify(data);
            
            await file.save(jsonData, {
                contentType: 'application/json',
                resumable: false,
                metadata: {
                    metadata: {
                        workflowId,
                        nodeId,
                        originalFileName,
                        uploadedAt: new Date().toISOString(),
                        rowCount: Array.isArray(data) ? data.length : 1
                    }
                }
            });

            console.log(`[GCS] Uploaded ${gcsPath} (${(jsonData.length / 1024).toFixed(2)} KB)`);

            return {
                success: true,
                gcsPath,
                size: jsonData.length,
                rowCount: Array.isArray(data) ? data.length : 1
            };

        } catch (error) {
            console.error('[GCS] Upload error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Download workflow data from GCS
     * @param {string} gcsPath - Path in GCS bucket
     * @returns {object} { success, data, error }
     */
    async downloadWorkflowData(gcsPath) {
        if (!this.initialized) {
            await this.init();
            if (!this.initialized) {
                return { success: false, error: 'GCS not initialized' };
            }
        }

        try {
            const file = this.bucket.file(gcsPath);
            
            const [exists] = await file.exists();
            if (!exists) {
                return { success: false, error: 'File not found in GCS' };
            }

            const [contents] = await file.download();
            const data = JSON.parse(contents.toString());

            console.log(`[GCS] Downloaded ${gcsPath}`);

            return {
                success: true,
                data,
                rowCount: Array.isArray(data) ? data.length : 1
            };

        } catch (error) {
            console.error('[GCS] Download error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete workflow data from GCS
     * @param {string} gcsPath - Path in GCS bucket
     * @returns {object} { success, error }
     */
    async deleteWorkflowData(gcsPath) {
        if (!this.initialized) {
            await this.init();
            if (!this.initialized) {
                return { success: false, error: 'GCS not initialized' };
            }
        }

        try {
            const file = this.bucket.file(gcsPath);
            await file.delete({ ignoreNotFound: true });
            
            console.log(`[GCS] Deleted ${gcsPath}`);
            return { success: true };

        } catch (error) {
            console.error('[GCS] Delete error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete all data for a workflow
     * @param {string} workflowId - Workflow ID
     * @returns {object} { success, deletedCount, error }
     */
    async deleteWorkflowFolder(workflowId) {
        if (!this.initialized) {
            await this.init();
            if (!this.initialized) {
                return { success: false, error: 'GCS not initialized' };
            }
        }

        try {
            const prefix = `workflows/${workflowId}/`;
            const [files] = await this.bucket.getFiles({ prefix });
            
            let deletedCount = 0;
            for (const file of files) {
                await file.delete();
                deletedCount++;
            }

            console.log(`[GCS] Deleted ${deletedCount} files for workflow ${workflowId}`);
            return { success: true, deletedCount };

        } catch (error) {
            console.error('[GCS] Delete folder error:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Singleton instance
const gcsService = new GCSService();

module.exports = { gcsService, GCSService };

