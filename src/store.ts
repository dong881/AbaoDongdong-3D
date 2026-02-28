import { create } from 'zustand';

export type AppMode = 'LOADING' | 'TREE' | 'EXPLODING' | 'PHOTOS' | 'RETRACTING';

export const DEFAULT_ZOOM_SCALE = 1;
export const DEFAULT_ROTATION = 0.5;

/** Represents a file fetched from Google Drive with optional cached blob URL. */
export interface DriveFile {
    id: string;
    name: string;
    thumbnailLink?: string;
    webContentLink?: string;
    mimeType: string;
    blobUrl?: string; // Cache for blob URL
}

/** Global application state managing mode, photos, camera tilt/zoom, and hand detection. */
export interface ExperienceState {
    mode: AppMode;
    setMode: (mode: AppMode) => void;

    rotation: number;
    setRotation: (rotation: number) => void; // Normalized 0-1 or actual radians

    photos: DriveFile[];
    setPhotos: (photos: DriveFile[]) => void;

    activePhotoIndex: number;
    visitedIndices: Set<number>;

    tiltX: number;
    tiltY: number;
    zoomScale: number;
    setTilt: (x: number, y: number) => void;
    resetTilt: () => void;
    setZoomScale: (scale: number) => void;

    nextPhoto: () => void;
    prevPhoto: () => void;

    isHandDetected: boolean;
    setIsHandDetected: (detected: boolean) => void;
}

export const useExperienceStore = create<ExperienceState>((set) => ({
    mode: 'LOADING',
    setMode: (mode) => set({ mode }),

    rotation: DEFAULT_ROTATION,
    setRotation: (r) => set({ rotation: r }),

    tiltX: 0,
    tiltY: 0,
    setTilt: (x, y) => set({ tiltX: x, tiltY: y }),
    resetTilt: () => set({ tiltX: 0, tiltY: 0 }),

    photos: [],
    setPhotos: (photos) => {
        // Sort Newest to Oldest (Name Descending Assumption)
        const sorted = [...photos].sort((a, b) => b.name.localeCompare(a.name));
        set({ photos: sorted, visitedIndices: new Set([0]) });
    },

    activePhotoIndex: 0,
    visitedIndices: new Set([0]),

    zoomScale: DEFAULT_ZOOM_SCALE,
    setZoomScale: (zoomScale) => set({ zoomScale }),

    nextPhoto: () => set((state) => {
        if (state.photos.length <= 1) return {};

        // Smart Random
        const current = state.activePhotoIndex;
        const total = state.photos.length;
        let nextIndex = current;

        for (let i = 0; i < 10; i++) {
            const jump = 1 + Math.floor(Math.random() * 4);
            nextIndex = (current + jump) % total;
            if (nextIndex !== current) break;
        }

        const newVisited = new Set(state.visitedIndices);
        newVisited.add(nextIndex);

        return { activePhotoIndex: nextIndex, visitedIndices: newVisited, zoomScale: DEFAULT_ZOOM_SCALE };
    }),
    prevPhoto: () => set((state) => {
        if (state.photos.length <= 1) return {};
        return {
            activePhotoIndex: (state.activePhotoIndex - 1 + state.photos.length) % state.photos.length,
            zoomScale: DEFAULT_ZOOM_SCALE
        };
    }),

    isHandDetected: false,
    setIsHandDetected: (isHandDetected) => set({ isHandDetected }),
}));
