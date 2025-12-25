import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import { useExperienceStore } from '../store';
import { useFrame } from '@react-three/fiber';

export const HandController = () => {
    const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
    const recognizerRef = useRef<GestureRecognizer | null>(null);
    const { setRotation, setMode, mode, setIsHandDetected, nextPhoto, prevPhoto, setZoomScale, setTilt } = useExperienceStore();

    const [loaded, setLoaded] = useState(false);
    const lastGestureTime = useRef(0);

    useEffect(() => {
        const init = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );

            recognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });

            // Setup Camera
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
            videoRef.current.play();

            videoRef.current.onloadeddata = () => {
                setLoaded(true);
            };
        };

        init();
    }, []);

    useFrame((state) => {
        if (!loaded || !recognizerRef.current || !videoRef.current) return;

        // Process every frame or throttle? optimized for R3F frame loop
        try {
            if (videoRef.current.currentTime > 0) {
                const result = recognizerRef.current.recognizeForVideo(videoRef.current, Date.now());

                if (result.gestures.length > 0 && result.landmarks.length > 0) {
                    setIsHandDetected(true);
                    const gesture = result.gestures[0][0]; // Top match
                    const landmarks = result.landmarks[0];

                    // 1. Rotation 
                    const wristX = landmarks[0].x;
                    setRotation(1 - wristX);

                    // 2. Pinch Detection
                    const thumbTip = landmarks[4];
                    const indexTip = landmarks[8];
                    const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

                    if (mode === 'PHOTOS' || mode === 'TREE') {
                        // Map 0.05 -> 1, 0.2 -> 2.5
                        const mappedZoom = 1 + Math.max(0, (distance - 0.05) * 8);
                        setZoomScale(Math.min(3, mappedZoom)); // Clamp max zoom

                        // TILT CONTROL (When pinching)
                        // Map wrist position relative to center (0.5) to Tilt
                        // User requested: "Lock Up/Down (X) to almost flat", "Right/Left (Y) slightly adjustable"
                        // Multipliers: X -> -0.1 (Tiny adjustment), Y -> -0.8 (Standard)

                        const tiltXVal = (landmarks[0].y - 0.5) * -0.1; // Almost locked vertically
                        const tiltYVal = (landmarks[0].x - 0.5) * -0.8; // Left/Right adjustable
                        setTilt(tiltXVal, tiltYVal);
                    } else {
                        // Reset tilt when not pinching? Or keep?
                        // If we want "reset to front", we should decay it.
                        // But for now let's just update if pinching.
                    }

                    // 3. Gesture State Logic
                    const now = state.clock.elapsedTime;
                    const isCooldown = (now - lastGestureTime.current) < 1.0;

                    if (gesture.categoryName === 'Open_Palm') {
                        if (mode === 'TREE' && !isCooldown) {
                            setMode('EXPLODING');
                            setTimeout(() => setMode('PHOTOS'), 1500);
                            lastGestureTime.current = now;
                        }
                    }

                    if (gesture.categoryName === 'Closed_Fist') {
                        if (mode === 'PHOTOS' && !isCooldown) {
                            setMode('RETRACTING');
                            setTimeout(() => setMode('TREE'), 1500);
                            lastGestureTime.current = now;
                        }
                    }

                    if (!isCooldown) {
                        if (gesture.categoryName === 'Thumb_Up') {
                            nextPhoto();
                            lastGestureTime.current = now;
                        }
                        else if (gesture.categoryName === 'Victory') {
                            prevPhoto();
                            lastGestureTime.current = now;
                        }
                    }

                } else {
                    setIsHandDetected(false);
                }
            }
        } catch (e) {
            console.error(e);
        }
    });

    return null; // Logic only
};
