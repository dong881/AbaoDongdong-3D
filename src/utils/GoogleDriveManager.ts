import { gapi } from 'gapi-script';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const FOLDER_ID = import.meta.env.VITE_GOOGLE_FOLDER_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient: any;

// Initialize GAPI Client (for making requests)
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

// Initialize GIS Token Client (for Auth)
export const initTokenClient = (callback: (response: any) => void) => {
    // @ts-ignore
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
                callback(tokenResponse);
            }
        },
    });
};

// Trigger Popup
export const requestAccessToken = () => {
    if (tokenClient) {
        // Skip prompt if we can, but usually for first time it asks
        tokenClient.requestAccessToken({ prompt: '' });
    } else {
        console.error("Token Client not initialized");
    }
}

// Helper to securely fetch blob content
export const fetchFileBlob = async (fileId: string): Promise<string | null> => {
    try {
        const token = gapi.client.getToken()?.access_token;
        if (!token) throw new Error("No access token");

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error(`Failed to fetch blob for ${fileId}`, e);
        return null;
    }
}

export const listFiles = async () => {
    if (!FOLDER_ID) throw new Error("Folder ID not configured");

    // Include video/mp4 and other video types
    const query = `'${FOLDER_ID}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`;

    try {
        const response = await gapi.client.drive.files.list({
            'q': query,
            'pageSize': 100,
            'fields': 'files(id, name, mimeType, thumbnailLink, webContentLink)'
        });

        return response.result.files || [];
    } catch (err) {
        console.error("Error listing files", err);
        throw err;
    }
};
