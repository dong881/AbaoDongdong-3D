import { gapi } from 'gapi-script';
import type { DriveFile } from '../store';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const FOLDER_ID = import.meta.env.VITE_GOOGLE_FOLDER_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

/** Maximum number of files to fetch from Google Drive per page. */
const MAX_PAGE_SIZE = 100;

/** Maximum retry attempts for blob fetching. */
const MAX_FETCH_RETRIES = 2;

interface TokenClient {
    requestAccessToken: (options: { prompt: string }) => void;
}

interface TokenResponse {
    access_token?: string;
}

let tokenClient: TokenClient | null = null;

/** In-memory cache for blob URLs keyed by file ID. */
const blobUrlCache = new Map<string, string>();

/**
 * Initialize GAPI Client for making Google Drive API requests.
 * Must be called before any other Drive operations.
 */
export const initGapiClient = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    discoveryDocs: [DISCOVERY_DOC],
                });
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
};

/**
 * Initialize GIS Token Client for OAuth2 authentication.
 * @param callback - Called with the token response after successful auth.
 */
export const initTokenClient = (callback: (response: TokenResponse) => void) => {
    // @ts-expect-error google.accounts is loaded from external script
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: TokenResponse) => {
            if (tokenResponse?.access_token) {
                callback(tokenResponse);
            }
        },
    }) as TokenClient;
};

/** Trigger the OAuth2 popup to request an access token. */
export const requestAccessToken = () => {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: '' });
    } else {
        console.error('Token Client not initialized');
    }
};

/**
 * Fetch a file's content as a blob URL, with caching and retry logic.
 * @param fileId - Google Drive file ID.
 * @returns Blob URL string or null on failure.
 */
export const fetchFileBlob = async (fileId: string): Promise<string | null> => {
    // Return cached URL if available
    const cached = blobUrlCache.get(fileId);
    if (cached) return cached;

    const token = gapi.client.getToken()?.access_token;
    if (!token) {
        console.error('No access token available for blob fetch');
        return null;
    }

    for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt++) {
        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) {
                throw new Error(`Fetch failed: ${response.status}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            blobUrlCache.set(fileId, url);
            return url;
        } catch (e) {
            if (attempt === MAX_FETCH_RETRIES) {
                console.error(`Failed to fetch blob for ${fileId} after ${MAX_FETCH_RETRIES + 1} attempts`, e);
                return null;
            }
            // Brief delay before retry
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
    }

    return null;
};

/**
 * Revoke a cached blob URL to free memory.
 * @param fileId - Google Drive file ID whose blob URL should be revoked.
 */
export const revokeBlobUrl = (fileId: string) => {
    const url = blobUrlCache.get(fileId);
    if (url) {
        URL.revokeObjectURL(url);
        blobUrlCache.delete(fileId);
    }
};

/** Revoke all cached blob URLs. Useful for cleanup on unmount. */
export const revokeAllBlobUrls = () => {
    blobUrlCache.forEach((url) => URL.revokeObjectURL(url));
    blobUrlCache.clear();
};

/**
 * List image and video files from the configured Google Drive folder.
 * @returns Array of DriveFile objects.
 */
export const listFiles = async (): Promise<DriveFile[]> => {
    if (!FOLDER_ID) throw new Error('Folder ID not configured');

    const query = `'${FOLDER_ID}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`;

    try {
        const response = await gapi.client.drive.files.list({
            q: query,
            pageSize: MAX_PAGE_SIZE,
            fields: 'files(id, name, mimeType, thumbnailLink, webContentLink)',
        });

        return (response.result.files || []) as DriveFile[];
    } catch (err) {
        console.error('Error listing files', err);
        throw err;
    }
};
