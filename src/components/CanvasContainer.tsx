import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Suspense } from 'react';

import { Background } from './Background';
import { ParticleTree } from './ParticleTree';
import { PhotoWall } from './PhotoWall';
import { HandController } from './HandController';
import { AudioPlayer } from './AudioPlayer';
import { useExperienceStore } from '../store';

/** Maximum camera distance for OrbitControls. */
const MAX_CAMERA_DISTANCE = 30;
/** Minimum camera distance for OrbitControls. */
const MIN_CAMERA_DISTANCE = 5;
/** Camera auto-rotate speed when in TREE mode. */
const AUTO_ROTATE_SPEED = 0.5;

const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: "'Outfit', sans-serif",
    textAlign: 'center',
    pointerEvents: 'none',
    textShadow: '0 0 10px #FFC0CB',
    width: '100%',
};

const hintStyle: React.CSSProperties = { fontSize: '1.2rem' };

export const CanvasContainer = () => {
    const mode = useExperienceStore((s) => s.mode);
    const isHandDetected = useExperienceStore((s) => s.isHandDetected);

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#050205' }}>
            <Canvas camera={{ position: [0, 0, 18], fov: 60 }} dpr={[1, 2]}>
                <OrbitControls
                    enableZoom={true}
                    enablePan={false}
                    autoRotate={mode === 'TREE'}
                    autoRotateSpeed={AUTO_ROTATE_SPEED}
                    maxDistance={MAX_CAMERA_DISTANCE}
                    minDistance={MIN_CAMERA_DISTANCE}
                />

                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#FFD700" />

                <Suspense fallback={null}>
                    <Background />
                    <ParticleTree />
                    <PhotoWall />
                    <HandController />
                </Suspense>

                <EffectComposer>
                    <Bloom
                        luminanceThreshold={0.2}
                        luminanceSmoothing={0.9}
                        height={300}
                        intensity={1.5}
                    />
                </EffectComposer>
            </Canvas>

            <AudioPlayer />

            {/* UI Overlay */}
            <div style={overlayStyle} role="status" aria-live="polite">
                {mode === 'TREE' && (
                    <p style={hintStyle}>
                        {isHandDetected ? '✋ Hand Detected — Open Palm to Reveal Memories' : 'Show Your Hand to Begin'}
                    </p>
                )}
                {mode === 'PHOTOS' && (
                    <p style={hintStyle}>Spread fingers to Zoom • Thumb Up for Next • Fist to Return</p>
                )}
                {(mode === 'EXPLODING' || mode === 'RETRACTING') && (
                    <p style={hintStyle}>✨ Transitioning...</p>
                )}
            </div>
        </div>
    );
};
