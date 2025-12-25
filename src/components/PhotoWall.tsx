import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useExperienceStore } from '../store';
import { Image, Text, Html } from '@react-three/drei';
import { Component, type ReactNode } from 'react';
import { fetchFileBlob } from '../utils/GoogleDriveManager';

// Error Boundary
class ImageErrorBoundary extends Component<{ children: ReactNode, fallback: ReactNode }, { hasError: boolean }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(_error: any) {
        return { hasError: true };
    }
    componentDidCatch(_error: any, _errorInfo: any) {
        // Suppress
    }
    render() {
        if (this.state.hasError) return this.props.fallback;
        return this.props.children;
    }
}

// Spiral Transition PhotoWall
export const PhotoWall = () => {
    const { photos, activePhotoIndex, mode, zoomScale, tiltX, tiltY } = useExperienceStore();
    const groupRef = useRef<THREE.Group>(null);

    // Track previous active index to handle transitions
    const [displayedPhoto, setDisplayedPhoto] = useState<any>(null);
    const [exitingPhoto, setExitingPhoto] = useState<any>(null);

    const transitionProgress = useRef(1.0); // 0.0 (Start) -> 1.0 (End)
    const lastActiveIndex = useRef(activePhotoIndex);

    // Sync state on change
    useEffect(() => {
        if (!photos || photos.length === 0) return;

        const current = photos[activePhotoIndex];

        // Initial Load
        if (!displayedPhoto && !exitingPhoto) {
            setDisplayedPhoto(current);
            lastActiveIndex.current = activePhotoIndex;
            return;
        }

        // Change Detected
        if (activePhotoIndex !== lastActiveIndex.current) {
            // Former display becomes exiting
            setExitingPhoto(photos[lastActiveIndex.current]);
            // New active becomes display
            setDisplayedPhoto(current);

            // Reset transition animation
            transitionProgress.current = 0.0;
            lastActiveIndex.current = activePhotoIndex;
        }

        // PRELOAD NEXT MEDIA (Aggressive)
        // Fetch next 3 and previous 1 to ensure smooth scrolling
        const count = photos.length;
        const preloadOffsets = [1, 2, 3, -1];

        preloadOffsets.forEach(offset => {
            const idx = (activePhotoIndex + offset + count) % count;
            const file = photos[idx];
            if (file && !file.blobUrl) { // Only fetch if not already cached
                fetchFileBlob(file.id);
            }
        });

    }, [activePhotoIndex, photos, displayedPhoto, exitingPhoto]);

    useFrame((_state, delta) => {
        if (!groupRef.current) return;

        // Advance Transition
        if (transitionProgress.current < 1.0) {
            transitionProgress.current += delta * 1.5; // Speed adjustment
            if (transitionProgress.current > 1.0) {
                transitionProgress.current = 1.0;
                setExitingPhoto(null); // Cleanup
            }
        }
    });

    if (mode !== 'PHOTOS' || !photos || photos.length === 0) return null;

    return (
        <group ref={groupRef}>
            {/* Exiting Photo: Spiraling OUT (Backwards and Away) */}
            {exitingPhoto && (
                <MediaItem
                    key={`exit-${exitingPhoto.id}`}
                    file={exitingPhoto}
                    isActive={false}
                    zoomScale={zoomScale}
                    // Animation Params
                    progress={transitionProgress.current}
                    isExiting={true}
                />
            )}

            {/* Entering/Active Photo: Spiraling IN (From back to Front) */}
            {displayedPhoto && (
                <MediaItem
                    key={`active-${displayedPhoto.id}`}
                    file={displayedPhoto}
                    isActive={true}
                    zoomScale={zoomScale}
                    tiltX={tiltX}
                    tiltY={tiltY}
                    // Animation Params
                    progress={transitionProgress.current}
                    isExiting={false}
                    renderOrder={10} // Always on top
                />
            )}
        </group>
    );
};

// Helper for spiral math
const getSpiralState = (progress: number, isExiting: boolean) => {
    // 0 -> 1
    const t = isExiting ? progress : (1 - progress);
    // If exiting: 0 (Center) -> 1 (Far)
    // If entering: 1 (Far) -> 0 (Center) (t logic reversed above for entering calculation)

    // Position: Center (0,0,0) -> Far (0, 0, -15) + Helix
    const distance = t * 15;
    const angle = t * Math.PI * 4; // 2 spins

    const x = Math.sin(angle) * t * 5; // Wider as it goes back
    const y = Math.cos(angle * 0.5) * t * 2; // Vertical wander
    const z = -distance;

    const scale = 1 - (t * 0.5); // Shrink as it goes back
    const opacity = 1 - t; // Fade out

    return { position: [x, y, z] as [number, number, number], rotation: [0, angle, 0] as [number, number, number], scale, opacity };
};


const MediaItem = (props: any) => {
    const { file, isActive, zoomScale, tiltX, tiltY, progress, isExiting, renderOrder } = props;
    const [blobUrl, setBlobUrl] = useState<string | null>(file.blobUrl || null);
    const meshRef = useRef<THREE.Group>(null);
    const isVideo = file.mimeType.startsWith('video/');

    // Fetch blob logic same as before...
    useEffect(() => {
        let active = true;
        const loadBlob = async () => {
            if (blobUrl) return;
            // Always load for now as there are only 2 items max
            const url = await fetchFileBlob(file.id);
            if (active && url) {
                setBlobUrl(url);
                file.blobUrl = url;
            }
        };
        loadBlob();
        return () => { active = false; };
    }, [file.id]);

    useFrame((state) => {
        if (!meshRef.current) return;

        // ANIMATION OR STATIC
        if (isActive && progress >= 1.0) {
            // STATIC (Resting State)
            // Apply Manual Tilt + LookAt
            meshRef.current.position.set(0, 0, 0);
            meshRef.current.scale.setScalar(1.5 * zoomScale);

            meshRef.current.lookAt(state.camera.position);
            meshRef.current.rotateX(tiltX || 0);
            meshRef.current.rotateY(tiltY || 0);
        } else {
            // TRANSITIONING (Entering or Exiting)
            const anim = getSpiralState(progress, isExiting);

            meshRef.current.position.set(...anim.position);

            // For rotation, we want the spiral spin + general orientation
            meshRef.current.rotation.set(...anim.rotation);

            // Scale and Zoom
            // If Entering and near end, mix in zoomScale? 
            // For simplicity, just use anim scale * base 1.5
            const baseScale = 1.5 * (isActive ? zoomScale : 1);
            meshRef.current.scale.setScalar(anim.scale * baseScale);

            // Opacity is handled by changing material opacity or just removing?
            // We pass opacity to Children or check opacity prop
            // But Drei Image handles opacity.
        }
    });

    // Delay "Loading..." display to prevent flash on fast/cached loads
    const [showLoading, setShowLoading] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setShowLoading(true), 500); // 0.5s grace period
        return () => clearTimeout(timer);
    }, []);

    const fallback = (
        <group>
            {showLoading && (
                <Text color="#FF4444" fontSize={0.2} anchorX="center" anchorY="middle">Loading...</Text>
            )}
        </group>
    );

    const opacityVal = isExiting ? (1 - progress) : progress;

    return (
        <group ref={meshRef} renderOrder={renderOrder}>
            <ImageErrorBoundary fallback={fallback}>
                {isVideo && isActive && blobUrl ? (
                    <Html transform style={{
                        width: '300px', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: opacityVal, transition: 'opacity 0.2s'
                    }}>
                        <video src={blobUrl} autoPlay loop style={{ width: '100%', borderRadius: '10px', boxShadow: '0 0 20px rgba(255,215,0,0.5)' }} />
                    </Html>
                ) : (
                    blobUrl ? (
                        <Image url={blobUrl} transparent opacity={opacityVal} side={THREE.DoubleSide} scale={[3, 4]} />
                    ) : (showLoading ? <Text color="#888">Loading...</Text> : null)
                )}
            </ImageErrorBoundary>

            {/* Do not show text if far away to reduce clutter? Or just fade it */}
            {file.name && opacityVal > 0.5 && (
                <Html position={[0, -1.8, 0]} center transform style={{
                    color: '#FFD700', fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
                    fontSize: '24px', fontWeight: 'bold', textShadow: '0 0 4px black',
                    whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none',
                    opacity: opacityVal
                }}>
                    {file.name.replace(/\.[^/.]+$/, "")}
                </Html>
            )}
        </group>
    )
}
