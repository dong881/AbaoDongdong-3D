import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import { useExperienceStore } from '../store';
import { useFrame } from '@react-three/fiber';

// ── Constants ───────────────────────────────────────────────────
const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm';
const GESTURE_MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const GESTURE_COOLDOWN_SECONDS = 1.0;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_OFFSET = 0.05;
const ZOOM_SCALE_FACTOR = 8;
const TILT_X_MULTIPLIER = -0.1;
const TILT_Y_MULTIPLIER = -0.8;
const TRANSITION_DELAY_MS = 1500;

/**
 * Map the pinch distance between thumb and index finger to a zoom level.
 * Distance ~0.05 → zoom 1x (min), distance ~0.2+ → zoom 3x (max).
 */
const calculateZoomFromPinchDistance = (distance: number): number => {
    const zoom = ZOOM_MIN + Math.max(0, (distance - ZOOM_OFFSET) * ZOOM_SCALE_FACTOR);
    return Math.min(ZOOM_MAX, zoom);
};

export const HandController = () => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const recognizerRef = useRef<GestureRecognizer | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const setRotation = useExperienceStore((s) => s.setRotation);
    const setMode = useExperienceStore((s) => s.setMode);
    const setIsHandDetected = useExperienceStore((s) => s.setIsHandDetected);
    const nextPhoto = useExperienceStore((s) => s.nextPhoto);
    const prevPhoto = useExperienceStore((s) => s.prevPhoto);
    const setZoomScale = useExperienceStore((s) => s.setZoomScale);
    const setTilt = useExperienceStore((s) => s.setTilt);

    // Read mode from ref to avoid re-renders in useFrame
    const modeRef = useRef(useExperienceStore.getState().mode);
    useEffect(() => {
        return useExperienceStore.subscribe((state) => {
            modeRef.current = state.mode;
        });
    }, []);

    const [loaded, setLoaded] = useState(false);
    const lastGestureTime = useRef(0);

    const clearTransitionTimer = useCallback(() => {
        if (transitionTimerRef.current !== null) {
            clearTimeout(transitionTimerRef.current);
            transitionTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

                const recognizer = await GestureRecognizer.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: GESTURE_MODEL_URL,
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numHands: 1,
                });

                if (cancelled) {
                    recognizer.close();
                    return;
                }
                recognizerRef.current = recognizer;

                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    recognizer.close();
                    return;
                }
                streamRef.current = stream;

                const video = document.createElement('video');
                video.srcObject = stream;
                video.playsInline = true;
                video.muted = true;
                video.play();

                video.onloadeddata = () => {
                    if (!cancelled) {
                        videoRef.current = video;
                        setLoaded(true);
                    }
                };
            } catch (e) {
                console.error('HandController init failed:', e);
            }
        };

        init();

        return () => {
            cancelled = true;

            // Cleanup camera stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }

            // Cleanup gesture recognizer
            if (recognizerRef.current) {
                recognizerRef.current.close();
                recognizerRef.current = null;
            }

            // Cleanup video element
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.srcObject = null;
                videoRef.current = null;
            }

            clearTransitionTimer();
        };
    }, [clearTransitionTimer]);

    useFrame((state) => {
        if (!loaded || !recognizerRef.current || !videoRef.current) return;

        try {
            if (videoRef.current.currentTime <= 0) return;

            const result = recognizerRef.current.recognizeForVideo(videoRef.current, Date.now());

            if (result.gestures.length > 0 && result.landmarks.length > 0) {
                setIsHandDetected(true);
                const gesture = result.gestures[0][0];
                const landmarks = result.landmarks[0];
                const mode = modeRef.current;

                // 1. Rotation from wrist X position
                const wristX = landmarks[0].x;
                setRotation(1 - wristX);

                // 2. Pinch-based zoom
                const thumbTip = landmarks[4];
                const indexTip = landmarks[8];
                const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

                if (mode === 'PHOTOS' || mode === 'TREE') {
                    setZoomScale(calculateZoomFromPinchDistance(distance));

                    const tiltXVal = (landmarks[0].y - 0.5) * TILT_X_MULTIPLIER;
                    const tiltYVal = (landmarks[0].x - 0.5) * TILT_Y_MULTIPLIER;
                    setTilt(tiltXVal, tiltYVal);
                }

                // 3. Gesture state transitions
                const now = state.clock.elapsedTime;
                const isCooldown = now - lastGestureTime.current < GESTURE_COOLDOWN_SECONDS;

                if (!isCooldown) {
                    if (gesture.categoryName === 'Open_Palm' && mode === 'TREE') {
                        setMode('EXPLODING');
                        clearTransitionTimer();
                        transitionTimerRef.current = setTimeout(
                            () => setMode('PHOTOS'),
                            TRANSITION_DELAY_MS
                        );
                        lastGestureTime.current = now;
                    } else if (gesture.categoryName === 'Closed_Fist' && mode === 'PHOTOS') {
                        setMode('RETRACTING');
                        clearTransitionTimer();
                        transitionTimerRef.current = setTimeout(
                            () => setMode('TREE'),
                            TRANSITION_DELAY_MS
                        );
                        lastGestureTime.current = now;
                    } else if (gesture.categoryName === 'Thumb_Up') {
                        nextPhoto();
                        lastGestureTime.current = now;
                    } else if (gesture.categoryName === 'Victory') {
                        prevPhoto();
                        lastGestureTime.current = now;
                    }
                }
            } else {
                setIsHandDetected(false);
            }
        } catch (e) {
            console.error('Hand recognition error:', e);
        }
    });

    return null;
};
