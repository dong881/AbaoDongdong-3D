import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const Background = () => {
    // Stars
    const starCount = 2000;
    const starGeo = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            // Spread stars far out
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        return geo;
    }, []);

    // Snow
    const snowCount = 1000;
    const snowRef = useRef<THREE.Points>(null);
    const snowGeo = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(snowCount * 3);
        const velocities = new Float32Array(snowCount); // Falling speed
        for (let i = 0; i < snowCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
            velocities[i] = 0.05 + Math.random() * 0.1;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));
        return geo;
    }, []);

    useFrame(() => {
        if (!snowRef.current) return;
        const positions = snowRef.current.geometry.attributes.position.array as Float32Array;
        const velocities = snowRef.current.geometry.attributes.velocity.array as Float32Array;

        for (let i = 0; i < snowCount; i++) {
            // Y position
            positions[i * 3 + 1] -= velocities[i];

            // Reset if below bottom
            if (positions[i * 3 + 1] < -25) {
                positions[i * 3 + 1] = 25;
            }
        }
        snowRef.current.geometry.attributes.position.needsUpdate = true;
        snowRef.current.rotation.y += 0.0005;
    });

    return (
        <>
            <points>
                <primitive object={starGeo} />
                <pointsMaterial size={0.1} color="#ffd1dc" transparent opacity={0.6} />
            </points>
            <points ref={snowRef}>
                <primitive object={snowGeo} />
                <pointsMaterial size={0.15} color="#fff0f5" transparent opacity={0.7} />
            </points>
        </>
    );
};
