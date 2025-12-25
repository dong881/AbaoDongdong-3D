import { create } from 'zustand';

export type AppMode = 'LOADING' | 'TREE' | 'EXPLODING' | 'PHOTOS' | 'RETRACTING';

export interface DriveFile {
    id: string;
    name: string;
    thumbnailLink?: string;
    webContentLink?: string;
    mimeType: string;
    blobUrl?: string; // Cache for blob URL
}

interface ExperienceState {
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
    setZoomScale: (scale: number) => void;

    nextPhoto: () => void;
    prevPhoto: () => void; // Keep prev for manual

    isHandDetected: boolean;
    setIsHandDetected: (detected: boolean) => void;
}

export const useExperienceStore = create<ExperienceState>((set) => ({
    mode: 'LOADING',
    setMode: (mode) => set({ mode }),

    rotation: 0.5,
    setRotation: (r) => set({ rotation: r }),

    tiltX: 0,
    tiltY: 0,
    setTilt: (x, y) => set({ tiltX: x, tiltY: y }),

    photos: [],
    setPhotos: (photos) => {
        // Sort Newest to Oldest (Name Descending Assumption)
        const sorted = [...photos].sort((a, b) => b.name.localeCompare(a.name));
        set({ photos: sorted, visitedIndices: new Set([0]) });
    },

    activePhotoIndex: 0,
    visitedIndices: new Set([0]),

    zoomScale: 1,
    setZoomScale: (zoomScale) => set({ zoomScale }),

    nextPhoto: () => set((state) => {
        if (state.photos.length <= 1) return state;

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

        return { activePhotoIndex: nextIndex, visitedIndices: newVisited, zoomScale: 1 };
    }),
    prevPhoto: () => set((state) => ({
        activePhotoIndex: (state.activePhotoIndex - 1 + state.photos.length) % state.photos.length,
        zoomScale: 1
    })),

    isHandDetected: false,
    setIsHandDetected: (isHandDetected) => set({ isHandDetected }),
}));
