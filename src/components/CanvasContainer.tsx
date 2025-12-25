import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Background } from './Background';
import { ParticleTree } from './ParticleTree';
import { PhotoWall } from './PhotoWall';
import { HandController } from './HandController';
import { AudioPlayer } from './AudioPlayer';
import { useExperienceStore } from '../store';
import { Suspense } from 'react';

export const CanvasContainer = () => {
    const { mode } = useExperienceStore();

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#050205' }}>
            <Canvas camera={{ position: [0, 0, 18], fov: 60 }} dpr={[1, 2]}>
                <OrbitControls
                    enableZoom={true}
                    enablePan={false}
                    // Auto rotate only in Tree mode
                    autoRotate={mode === 'TREE'}
                    autoRotateSpeed={0.5}
                    maxDistance={30}
                    minDistance={5}
                />

                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#FFD700" />

                <Suspense fallback={null}>
                    <Background />
                    <ParticleTree />
                    <PhotoWall />
                    <HandController />
                </Suspense>

                {/* Post Processing for the "Magical" Glow */}
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
            <div style={{
                position: 'absolute',
                bottom: 30,
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'rgba(255,255,255,0.8)',
                fontFamily: "'Outfit', sans-serif",
                textAlign: 'center',
                pointerEvents: 'none',
                textShadow: '0 0 10px #FFC0CB',
                width: '100%'
            }}>
                {mode === 'TREE' && <p style={{ fontSize: '1.2rem' }}>Open Hand to Reveal Memories</p>}
                {mode === 'PHOTOS' && <p style={{ fontSize: '1.2rem' }}>Spread fingers to Zoom • Thumb Up for Next • Fist to Return</p>}
            </div>
        </div>
    );
};
