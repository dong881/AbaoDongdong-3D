import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useExperienceStore } from '../store';
import type { DriveFile } from '../store';
import { Image, Text, Html } from '@react-three/drei';
import { fetchFileBlob } from '../utils/GoogleDriveManager';
import { ImageErrorBoundary } from './ImageErrorBoundary';

// ── Constants ───────────────────────────────────────────────────
const TRANSITION_SPEED = 1.5;
const SPIRAL_DISTANCE = 15;
const SPIRAL_SPINS = 4;
const SPIRAL_WIDTH_FACTOR = 5;
const SPIRAL_VERTICAL_FACTOR = 2;
const BASE_PHOTO_SCALE = 1.5;
const LOADING_DELAY_MS = 500;
const PRELOAD_OFFSETS = [1, 2, 3, -1];

// ── Spiral Math Helper ──────────────────────────────────────────

interface SpiralState {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
    opacity: number;
}

const getSpiralState = (progress: number, isExiting: boolean): SpiralState => {
    const t = isExiting ? progress : 1 - progress;

    const distance = t * SPIRAL_DISTANCE;
    const angle = t * Math.PI * SPIRAL_SPINS;

    const x = Math.sin(angle) * t * SPIRAL_WIDTH_FACTOR;
    const y = Math.cos(angle * 0.5) * t * SPIRAL_VERTICAL_FACTOR;
    const z = -distance;

    const scale = 1 - t * 0.5;
    const opacity = 1 - t;

    return {
        position: [x, y, z],
        rotation: [0, angle, 0],
        scale,
        opacity,
    };
};

// ── MediaItem Component ─────────────────────────────────────────

interface MediaItemProps {
    file: DriveFile;
    isActive: boolean;
    zoomScale: number;
    tiltX?: number;
    tiltY?: number;
    progress: number;
    isExiting: boolean;
    renderOrder?: number;
}

const MediaItem = ({
    file,
    isActive,
    zoomScale,
    tiltX,
    tiltY,
    progress,
    isExiting,
    renderOrder,
}: MediaItemProps) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(file.blobUrl ?? null);
    const meshRef = useRef<THREE.Group>(null);
    const isVideo = file.mimeType.startsWith('video/');
    // Internal ref for smooth per-frame progress
    const internalProgress = useRef(progress);

    // Sync when parent resets progress to 0
    useEffect(() => {
        if (progress < internalProgress.current) {
            internalProgress.current = progress;
        }
    }, [progress]);

    useEffect(() => {
        let active = true;
        if (!blobUrl) {
            fetchFileBlob(file.id).then((url) => {
                if (active && url) {
                    setBlobUrl(url);
                    file.blobUrl = url;
                }
            });
        }
        return () => {
            active = false;
        };
        // Only re-fetch when file.id changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file.id]);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        // Advance internal progress smoothly
        if (internalProgress.current < 1.0) {
            internalProgress.current = Math.min(1.0, internalProgress.current + delta * TRANSITION_SPEED);
        }
        const p = internalProgress.current;

        if (isActive && p >= 1.0) {
            // Static resting state
            meshRef.current.position.set(0, 0, 0);
            meshRef.current.scale.setScalar(BASE_PHOTO_SCALE * zoomScale);
            meshRef.current.lookAt(state.camera.position);
            meshRef.current.rotateX(tiltX ?? 0);
            meshRef.current.rotateY(tiltY ?? 0);
        } else {
            // Transitioning (entering or exiting)
            const anim = getSpiralState(p, isExiting);
            meshRef.current.position.set(...anim.position);
            meshRef.current.rotation.set(...anim.rotation);
            const baseScale = BASE_PHOTO_SCALE * (isActive ? zoomScale : 1);
            meshRef.current.scale.setScalar(anim.scale * baseScale);
        }
    });

    // Delay loading text to prevent flash on fast/cached loads
    const [showLoading, setShowLoading] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setShowLoading(true), LOADING_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);

    const fallback = (
        <group>
            {showLoading && (
                <Text color="#FF4444" fontSize={0.2} anchorX="center" anchorY="middle">
                    Loading...
                </Text>
            )}
        </group>
    );

    // Opacity is 1 when fully active, 0 when fully exited
    // During transition, the visual is handled by position/scale in useFrame
    const opacityVal = isExiting ? Math.max(0, 1 - progress) : Math.min(1, progress === 0 ? 0.01 : 1);
    const displayName = file.name?.replace(/\.[^/.]+$/, '') ?? '';

    return (
        <group ref={meshRef} renderOrder={renderOrder}>
            <ImageErrorBoundary fallback={fallback}>
                {isVideo && isActive && blobUrl ? (
                    <Html
                        transform
                        style={{
                            width: '300px',
                            height: '400px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: opacityVal,
                            transition: 'opacity 0.2s',
                        }}
                    >
                        <video
                            src={blobUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{
                                width: '100%',
                                borderRadius: '10px',
                                boxShadow: '0 0 20px rgba(255,215,0,0.5)',
                            }}
                        />
                    </Html>
                ) : blobUrl ? (
                    <Image
                        url={blobUrl}
                        transparent
                        opacity={opacityVal}
                        side={THREE.DoubleSide}
                        scale={[3, 4]}
                    />
                ) : showLoading ? (
                    <Text color="#888">Loading...</Text>
                ) : null}
            </ImageErrorBoundary>

            {displayName && opacityVal > 0.5 && (
                <Html
                    position={[0, -1.8, 0]}
                    center
                    transform
                    style={{
                        color: '#FFD700',
                        fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        textShadow: '0 0 4px black',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        opacity: opacityVal,
                    }}
                >
                    {displayName}
                </Html>
            )}
        </group>
    );
};

// ── PhotoWall Component ─────────────────────────────────────────

export const PhotoWall = () => {
    const photos = useExperienceStore((s) => s.photos);
    const activePhotoIndex = useExperienceStore((s) => s.activePhotoIndex);
    const mode = useExperienceStore((s) => s.mode);
    const zoomScale = useExperienceStore((s) => s.zoomScale);
    const tiltX = useExperienceStore((s) => s.tiltX);
    const tiltY = useExperienceStore((s) => s.tiltY);

    const groupRef = useRef<THREE.Group>(null);

    // Initialize displayed photo from initial state
    const [displayedPhoto, setDisplayedPhoto] = useState<DriveFile | null>(() => {
        if (photos && photos.length > 0) return photos[activePhotoIndex];
        return null;
    });
    const [exitingPhoto, setExitingPhoto] = useState<DriveFile | null>(null);
    const [transitionProgress, setTransitionProgress] = useState(1.0);

    const lastActiveIndex = useRef(activePhotoIndex);
    // Internal ref for smooth per-frame updates (avoids re-render per frame)
    const progressRef = useRef(1.0);

    // Preload nearby photos
    const preloadNearby = useCallback(
        (index: number) => {
            const count = photos.length;
            PRELOAD_OFFSETS.forEach((offset) => {
                const idx = (index + offset + count) % count;
                const file = photos[idx];
                if (file && !file.blobUrl) {
                    fetchFileBlob(file.id);
                }
            });
        },
        [photos]
    );

    useEffect(() => {
        if (!photos || photos.length === 0) return;

        // Change detected
        if (activePhotoIndex !== lastActiveIndex.current) {
            setExitingPhoto(photos[lastActiveIndex.current]);
            setDisplayedPhoto(photos[activePhotoIndex]);
            progressRef.current = 0.0;
            setTransitionProgress(0.0);
            lastActiveIndex.current = activePhotoIndex;
        }

        // Preload nearby photos
        preloadNearby(activePhotoIndex);
    }, [activePhotoIndex, photos, preloadNearby]);

    useFrame((_state, delta) => {
        if (!groupRef.current) return;

        if (progressRef.current < 1.0) {
            progressRef.current += delta * TRANSITION_SPEED;
            if (progressRef.current >= 1.0) {
                progressRef.current = 1.0;
                setTransitionProgress(1.0);
                setExitingPhoto(null);
            }
        }
    });

    if (mode !== 'PHOTOS' || !photos || photos.length === 0) return null;

    return (
        <group ref={groupRef}>
            {exitingPhoto && (
                <MediaItem
                    key={`exit-${exitingPhoto.id}`}
                    file={exitingPhoto}
                    isActive={false}
                    zoomScale={zoomScale}
                    progress={transitionProgress}
                    isExiting={true}
                />
            )}

            {displayedPhoto && (
                <MediaItem
                    key={`active-${displayedPhoto.id}`}
                    file={displayedPhoto}
                    isActive={true}
                    zoomScale={zoomScale}
                    tiltX={tiltX}
                    tiltY={tiltY}
                    progress={transitionProgress}
                    isExiting={false}
                    renderOrder={10}
                />
            )}
        </group>
    );
};
