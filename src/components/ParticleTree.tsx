import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial, Image } from '@react-three/drei';
import { useExperienceStore } from '../store';
import type { DriveFile } from '../store';
import { fetchFileBlob } from '../utils/GoogleDriveManager';
import { ImageErrorBoundary } from './ImageErrorBoundary';

// ── Constants ───────────────────────────────────────────────────
const PARTICLE_COUNT = 12000;
const TREE_HEIGHT = 20;
const TREE_MAX_RADIUS = 7.0;
const ORNAMENT_COUNT = 15;
const ORNAMENT_HEIGHT_RANGE: [number, number] = [-7, 7];
const STAR_TOPPER_Y = 10.5;

// ── Shader Material ─────────────────────────────────────────────
const TreeShaderMaterial = shaderMaterial(
    {
        uTime: 0,
        uMode: 0,
        uColor1: new THREE.Color('#00FF00'),
        uColor2: new THREE.Color('#FFD700'),
        uColor3: new THREE.Color('#FF4444'),
    },
    // Vertex Shader
    `
    uniform float uTime;
    uniform float uMode;
    attribute float aAngle;
    attribute float aRadius;
    attribute float aSpeed;
    attribute vec3 aRandom;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec3 pos = position;
      float t = uTime * aSpeed + aRandom.x * 10.0;

      // Mode 0: Tree
      vec3 treePos;
      treePos.y = pos.y;

      float currentAngle = aAngle + t * 0.2;
      float currentRadius = aRadius;
      currentRadius += sin(t * 1.5) * 0.15;

      treePos.x = cos(currentAngle) * currentRadius;
      treePos.z = sin(currentAngle) * currentRadius;

      // Mode 1: Explode
      vec3 explodePos = pos;
      explodePos.x *= 15.0 + (sin(uTime * 2.0) * 2.0);
      explodePos.z *= 15.0 + (cos(uTime * 2.0) * 2.0);
      explodePos.y *= 0.5;
      explodePos += aRandom * uMode * 10.0;

      vec3 finalPos = mix(treePos, explodePos, uMode);

      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      gl_PointSize = (60.0 * aRandom.y + 15.0) * (1.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;

      if (aRandom.z > 0.9) {
          vColor = vec3(1.0, 0.84, 0.0);
      } else if (aRandom.z > 0.8) {
          vColor = vec3(1.0, 0.0, 0.0);
      } else {
          vColor = mix(vec3(0.13, 0.55, 0.13), vec3(0.0, 0.4, 0.0), aRandom.y);
      }

      float sparkle = sin(t * 5.0 + aRandom.x * 10.0);
      if (sparkle > 0.8) vColor += 0.5;

      vAlpha = 1.0;
    }
  `,
    // Fragment Shader
    `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      if (dist > 0.5) discard;
      float strength = 1.0 - (dist * 2.0);
      strength = pow(strength, 1.5);
      gl_FragColor = vec4(vColor, vAlpha * strength);
    }
  `
);

extend({ TreeShaderMaterial });

// Type declaration for custom JSX element
declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        interface IntrinsicElements {
            treeShaderMaterial: Record<string, unknown>;
        }
    }
}

// ── Photo Ornament ──────────────────────────────────────────────

interface PhotoOrnamentProps {
    position: [number, number, number];
    file: DriveFile;
}

const PhotoOrnament = ({ position, file }: PhotoOrnamentProps) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(file.blobUrl ?? null);
    const ref = useRef<THREE.Group>(null);

    useEffect(() => {
        let mounted = true;
        if (!blobUrl && file.id) {
            fetchFileBlob(file.id).then((url) => {
                if (mounted && url) {
                    setBlobUrl(url);
                    file.blobUrl = url;
                }
            });
        }
        return () => {
            mounted = false;
        };
        // Only re-fetch when file.id changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file.id]);

    useFrame((state) => {
        if (ref.current) {
            ref.current.lookAt(state.camera.position);
            ref.current.position.y =
                position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.1;
        }
    });

    const url = blobUrl;

    const placeholder = (
        <group position={position}>
            <mesh>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshBasicMaterial color="#FFD700" wireframe opacity={0.3} transparent />
            </mesh>
        </group>
    );

    if (!url) {
        return placeholder;
    }

    return (
        <group ref={ref} position={position}>
            <ImageErrorBoundary fallback={placeholder}>
                <Image url={url} scale={[0.8, 1]} transparent opacity={0.9} side={THREE.DoubleSide} />
            </ImageErrorBoundary>
            <mesh position={[0, 0, -0.01]}>
                <planeGeometry args={[0.9, 1.1]} />
                <meshBasicMaterial color="#FFD700" />
            </mesh>
        </group>
    );
};

// ── Star Topper ─────────────────────────────────────────────────

const StarTopper = () => {
    return (
        <group position={[0, STAR_TOPPER_Y, 0]}>
            <mesh>
                <octahedronGeometry args={[1.5, 0]} />
                <meshBasicMaterial color="#FFD700" />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 4]}>
                <octahedronGeometry args={[1.5, 0]} />
                <meshBasicMaterial color="#FFA500" />
            </mesh>
            <pointLight distance={20} intensity={2} color="#FFD700" />
        </group>
    );
};

// Pre-generate particle data outside component to avoid impure calls during render
function createParticleData() {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const ang = new Float32Array(PARTICLE_COUNT);
    const rad = new Float32Array(PARTICLE_COUNT);
    const spd = new Float32Array(PARTICLE_COUNT);
    const rnd = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const y = Math.random() * TREE_HEIGHT - TREE_HEIGHT / 2;
        const relY = (y + TREE_HEIGHT / 2) / TREE_HEIGHT;
        const radius = (1.0 - relY) * TREE_MAX_RADIUS;
        const angle = Math.random() * Math.PI * 2 * 4;

        pos[i * 3] = 0;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = 0;
        ang[i] = angle;
        rad[i] = radius;
        spd[i] = 0.5 + Math.random();
        rnd[i * 3] = Math.random();
        rnd[i * 3 + 1] = Math.random();
        rnd[i * 3 + 2] = Math.random();
    }
    return { positions: pos, angles: ang, radii: rad, speeds: spd, randoms: rnd };
}

const particleData = createParticleData();

// ── Particle Tree ───────────────────────────────────────────────

export const ParticleTree = () => {
    const pointsRef = useRef<THREE.Points>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const groupRef = useRef<THREE.Group>(null);

    const mode = useExperienceStore((s) => s.mode);
    const photos = useExperienceStore((s) => s.photos);
    const zoomScale = useExperienceStore((s) => s.zoomScale);
    // Read rotation from store ref to avoid re-renders on every hand movement
    const rotationRef = useRef(useExperienceStore.getState().rotation);
    useEffect(() => {
        return useExperienceStore.subscribe((state) => {
            rotationRef.current = state.rotation;
        });
    }, []);

    const { positions, angles, radii, speeds, randoms } = particleData;

    const ornaments = useMemo(() => {
        if (!photos || photos.length === 0) return [];
        const selection = photos.slice(0, ORNAMENT_COUNT);
        return selection.map((photo, i) => {
            const t = i / ORNAMENT_COUNT;
            const y =
                t * (ORNAMENT_HEIGHT_RANGE[1] - ORNAMENT_HEIGHT_RANGE[0]) + ORNAMENT_HEIGHT_RANGE[0];
            const relY = (y + TREE_HEIGHT / 2) / TREE_HEIGHT;
            const r = (1.0 - relY) * TREE_MAX_RADIUS + 0.5;
            const angle = t * Math.PI * 2 * 3;

            return {
                position: [Math.cos(angle) * r, y, Math.sin(angle) * r] as [number, number, number],
                file: photo,
            };
        });
    }, [photos]);

    const targetModeRef = useRef(0);

    useFrame((_state, delta) => {
        if (!materialRef.current || !groupRef.current) return;
        materialRef.current.uniforms.uTime.value = _state.clock.elapsedTime;

        // Lerp mode transition
        const target = mode === 'EXPLODING' || mode === 'PHOTOS' ? 1.0 : 0.0;
        targetModeRef.current = THREE.MathUtils.lerp(targetModeRef.current, target, delta * 2.0);
        materialRef.current.uniforms.uMode.value = targetModeRef.current;

        // Rotation Logic (Hand controlled via ref to avoid re-renders)
        if (mode === 'TREE') {
            const rotation = rotationRef.current;
            const speed = (rotation - 0.5) * 2.0;
            const deadzone = 0.2;
            if (Math.abs(speed) > deadzone) {
                groupRef.current.rotation.y += speed * delta * 2.0;
            } else {
                groupRef.current.rotation.y += delta * 0.1;
            }
        }
    });

    return (
        <group ref={groupRef} scale={[zoomScale, zoomScale, zoomScale]}>
            <points ref={pointsRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                    <bufferAttribute attach="attributes-aAngle" args={[angles, 1]} />
                    <bufferAttribute attach="attributes-aRadius" args={[radii, 1]} />
                    <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
                    <bufferAttribute attach="attributes-aRandom" args={[randoms, 3]} />
                </bufferGeometry>
                <treeShaderMaterial
                    ref={materialRef}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>

            {mode === 'TREE' &&
                ornaments.map((o) => <PhotoOrnament key={o.file.id} position={o.position} file={o.file} />)}

            {mode === 'TREE' && <StarTopper />}
        </group>
    );
};
