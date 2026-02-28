import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Constants ───────────────────────────────────────────────────
const STAR_COUNT = 2000;
const SNOW_COUNT = 1000;
const SPREAD = 100;
const SNOW_SPREAD = 50;
const SNOW_BOTTOM = -25;
const SNOW_TOP = 25;
const SNOW_MIN_SPEED = 0.05;
const SNOW_MAX_SPEED = 0.1;
const SNOW_ROTATION_SPEED = 0.0005;
const STAR_SIZE = 0.1;
const SNOW_SIZE = 0.15;

// Pre-generate geometry data outside component to avoid impure calls during render
function createStarGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * SPREAD;
        positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
        positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
}

function createSnowGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(SNOW_COUNT * 3);
    const velocities = new Float32Array(SNOW_COUNT);
    for (let i = 0; i < SNOW_COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * SNOW_SPREAD;
        positions[i * 3 + 1] = (Math.random() - 0.5) * SNOW_SPREAD;
        positions[i * 3 + 2] = (Math.random() - 0.5) * SNOW_SPREAD;
        velocities[i] = SNOW_MIN_SPEED + Math.random() * SNOW_MAX_SPEED;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));
    return geo;
}

const starGeo = createStarGeometry();
const snowGeo = createSnowGeometry();

export const Background = () => {
    const snowRef = useRef<THREE.Points>(null);

    useFrame(() => {
        if (!snowRef.current) return;
        const posAttr = snowRef.current.geometry.attributes.position;
        const velAttr = snowRef.current.geometry.attributes.velocity;
        const positions = posAttr.array as Float32Array;
        const velocities = velAttr.array as Float32Array;

        for (let i = 0; i < SNOW_COUNT; i++) {
            positions[i * 3 + 1] -= velocities[i];
            if (positions[i * 3 + 1] < SNOW_BOTTOM) {
                positions[i * 3 + 1] = SNOW_TOP;
            }
        }
        posAttr.needsUpdate = true;
        snowRef.current.rotation.y += SNOW_ROTATION_SPEED;
    });

    return (
        <>
            <points>
                <primitive object={starGeo} />
                <pointsMaterial size={STAR_SIZE} color="#ffd1dc" transparent opacity={0.6} />
            </points>
            <points ref={snowRef}>
                <primitive object={snowGeo} />
                <pointsMaterial size={SNOW_SIZE} color="#fff0f5" transparent opacity={0.7} />
            </points>
        </>
    );
};
