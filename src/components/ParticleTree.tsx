import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial, Image } from '@react-three/drei';
import { useExperienceStore } from '../store';
import { fetchFileBlob } from '../utils/GoogleDriveManager';

// Define the Shader Material
const TreeShaderMaterial = shaderMaterial(
    {
        uTime: 0,
        uMode: 0,
        uColor1: new THREE.Color('#00FF00'), // Neon Green
        uColor2: new THREE.Color('#FFD700'), // Gold
        uColor3: new THREE.Color('#FF4444'), // Red Bright
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
      
      // Mode 1: Explode (Horizontal Expansion / Star Burst)
      vec3 explodePos = pos;
      // Expand horizontally significantly, flat on Y
      explodePos.x *= 15.0 + (sin(uTime * 2.0) * 2.0); 
      explodePos.z *= 15.0 + (cos(uTime * 2.0) * 2.0);
      explodePos.y *= 0.5; // Flatten height
      
      // Add "Light Speed" streak effect
      explodePos += aRandom * uMode * 10.0; 
      
      vec3 finalPos = mix(treePos, explodePos, uMode);

      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      // Bigger particles (was 25.0) -> 60.0 for impact
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

declare global {
    namespace JSX {
        interface IntrinsicElements {
            treeShaderMaterial: any;
        }
    }
}

// Simple Error Boundary for Tree Ornaments
import { Component, type ReactNode } from 'react';
class OrnamentErrorBoundary extends Component<{ children: ReactNode, fallback: ReactNode }, { hasError: boolean }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(_error: any) {
        return { hasError: true };
    }
    componentDidCatch(_error: any) {
        // suppress
    }
    render() {
        if (this.state.hasError) return this.props.fallback;
        return this.props.children;
    }
}

const PhotoOrnament = ({ position, file }: { position: [number, number, number], file: any }) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(file.blobUrl || null);
    const ref = useRef<THREE.Group>(null);

    useEffect(() => {
        let mounted = true;
        if (!blobUrl && file.id) {
            fetchFileBlob(file.id).then(url => {
                if (mounted && url) {
                    setBlobUrl(url);
                    file.blobUrl = url;
                }
            });
        }
        return () => { mounted = false; };
    }, [file.id]);

    useFrame((state) => {
        if (ref.current) {
            ref.current.lookAt(state.camera.position);
            ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.1;
        }
    });

    // STRICT SAFETY: Do NOT use thumbnailLink (causes 429). Wait for blob.
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
            <OrnamentErrorBoundary fallback={placeholder}>
                <Image
                    url={url}
                    scale={[0.8, 1]}
                    transparent
                    opacity={0.9}
                    side={THREE.DoubleSide}
                />
            </OrnamentErrorBoundary>
            {/* Outline/Frame */}
            <mesh position={[0, 0, -0.01]}>
                <planeGeometry args={[0.9, 1.1]} />
                <meshBasicMaterial color="#FFD700" />
            </mesh>
        </group>
    )
}



const StarTopper = () => {
    return (
        <group position={[0, 10.5, 0]}>
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

export const ParticleTree = () => {
    const pointsRef = useRef<THREE.Points>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const groupRef = useRef<THREE.Group>(null);

    const { mode, rotation, photos, zoomScale } = useExperienceStore();

    const count = 12000; // Increased from 6000 for denser tree

    const { positions, angles, radii, speeds, randoms } = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const ang = new Float32Array(count);
        const rad = new Float32Array(count);
        const spd = new Float32Array(count);
        const rnd = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const y = (Math.random() * 20) - 10;
            const relY = (y + 10) / 20;
            const radius = (1.0 - relY) * 7.0;
            const angle = Math.random() * Math.PI * 2 * 4;

            pos[i * 3] = 0; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 0;
            ang[i] = angle; rad[i] = radius; spd[i] = 0.5 + Math.random();
            rnd[i * 3] = Math.random(); rnd[i * 3 + 1] = Math.random(); rnd[i * 3 + 2] = Math.random();
        }
        return { positions: pos, angles: ang, radii: rad, speeds: spd, randoms: rnd };
    }, []);

    // Use top 10 photos as ornaments (unique logic)
    const ornaments = useMemo(() => {
        if (!photos || photos.length === 0) return [];
        const selection = photos.slice(0, 15); // Take first 15
        return selection.map((photo, i) => {
            // Spiral placement similar to decorations
            const t = i / 15;
            const y = (t * 14) - 7; // -7 to 7 height
            const relY = (y + 10) / 20;
            const r = (1.0 - relY) * 7.0 + 0.5; // Slightly outside
            const angle = t * Math.PI * 2 * 3;

            return {
                position: [Math.cos(angle) * r, y, Math.sin(angle) * r] as [number, number, number],
                file: photo
            };
        });
    }, [photos]);

    const targetModeRef = useRef(0);

    useFrame((state, delta) => {
        if (!materialRef.current || !groupRef.current) return;
        materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;

        // Lerp mode
        const target = (mode === 'EXPLODING' || mode === 'PHOTOS') ? 1.0 : 0.0;
        targetModeRef.current = THREE.MathUtils.lerp(targetModeRef.current, target, delta * 2.0);
        materialRef.current.uniforms.uMode.value = targetModeRef.current;

        // Rotation Logic (Hand controlled)
        if (mode === 'TREE') {
            // Rotation from store (0 to 1). 0.5 is numeric center.
            // We want to accumulate rotation or set target?
            // User said "Right/Left determines Left/Right rotation". This sounds like controlling speed or target angle.
            // Let's assume absolute mapping for direct feedback:
            // 0 -> -90 deg, 1 -> +90 deg?
            // Or continuous? "Left手勢決定左旋轉" -> Hand on left side makes it spin left.

            const speed = (rotation - 0.5) * 2.0; // -1 to 1
            // Deadzone
            if (Math.abs(speed) > 0.2) {
                groupRef.current.rotation.y += speed * delta * 2.0;
            } else {
                // Auto slow rotate
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
                {/* @ts-ignore */}
                <treeShaderMaterial
                    ref={materialRef}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>

            {/* Photo Ornaments */}
            {mode === 'TREE' && ornaments.map((o) => (
                <PhotoOrnament key={o.file.id} position={o.position} file={o.file} />
            ))}

            {/* Star Topper - Only in Tree Mode */}
            {mode === 'TREE' && <StarTopper />}
        </group>
    );
};
