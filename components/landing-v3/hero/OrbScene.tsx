'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, Float } from '@react-three/drei';
import * as THREE from 'three';
import { getHeroProgress } from './useScrollProgress';

/**
 * The Riverz Orb — a refractive glass sphere with three colored shards
 * inside that emerge and orbit outward as the user scrolls the hero.
 *
 * No HDRI file dependency — uses drei's `studio` preset which ships an
 * inlined environment cube. Keeps initial bundle leaner.
 */

function Orb() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const m = meshRef.current;
    if (!m) return;
    const p = getHeroProgress();
    // Shrink + drift down as scroll progresses.
    const scale = 1 - p * 0.55;
    m.scale.setScalar(scale);
    m.position.y = -p * 0.3;
    // Slow autonomous rotation always, accelerated by progress.
    m.rotation.y += delta * (0.18 + p * 0.6);
    m.rotation.x = Math.sin(performance.now() * 0.0003) * 0.08;
  });

  return (
    <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.05, 96, 96]} />
        <MeshTransmissionMaterial
          backside
          samples={6}
          thickness={0.45}
          transmission={1}
          roughness={0.06}
          ior={1.42}
          chromaticAberration={0.06}
          anisotropy={0.18}
          distortion={0.18}
          distortionScale={0.4}
          temporalDistortion={0.05}
          color="#ffffff"
          attenuationColor="#fff7d6"
          attenuationDistance={1.6}
        />
      </mesh>
    </Float>
  );
}

interface ShardProps {
  /** Final orbital position (when progress = 1). */
  finalPosition: [number, number, number];
  /** Final rotation (when progress = 1). */
  finalRotation: [number, number, number];
  color: string;
  /** When (0..1) this shard starts emerging. */
  startAt: number;
}

function Shard({ finalPosition, finalRotation, color, startAt }: ShardProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const m = meshRef.current;
    if (!m) return;
    const p = getHeroProgress();
    // Each shard has its own emergence window.
    const local = Math.min(1, Math.max(0, (p - startAt) / (1 - startAt)));
    // Smoothstep for a natural feel.
    const eased = local * local * (3 - 2 * local);

    m.position.x = finalPosition[0] * eased;
    m.position.y = finalPosition[1] * eased;
    m.position.z = finalPosition[2] * eased;
    m.rotation.x = finalRotation[0] * eased;
    m.rotation.y = finalRotation[1] * eased;
    m.rotation.z = finalRotation[2] * eased;

    const scale = 0.05 + eased * 0.95;
    m.scale.setScalar(scale);

    // Material opacity (kept on the mesh's material).
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.0 + eased;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[0.9, 1.2]} />
      <meshStandardMaterial
        color={color}
        roughness={0.35}
        metalness={0.05}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Shards() {
  return (
    <group>
      <Shard
        finalPosition={[-1.9, 0.85, 0.25]}
        finalRotation={[0, 0.35, -0.18]}
        color="#f7ff9e"
        startAt={0.18}
      />
      <Shard
        finalPosition={[2.0, 0.55, -0.1]}
        finalRotation={[0, -0.32, 0.12]}
        color="#14e0cc"
        startAt={0.32}
      />
      <Shard
        finalPosition={[0.15, -1.55, 0.35]}
        finalRotation={[0.18, 0.05, 0.08]}
        color="#0e0e13"
        startAt={0.46}
      />
    </group>
  );
}

interface OrbSceneProps {
  /** Lower DPR / cheaper materials on low-end devices. */
  lowPower?: boolean;
}

export function OrbScene({ lowPower = false }: OrbSceneProps) {
  return (
    <Canvas
      dpr={lowPower ? [1, 1] : [1, 2]}
      camera={{ position: [0, 0, 4.6], fov: 38 }}
      gl={{ antialias: !lowPower, alpha: true, preserveDrawingBuffer: false }}
      frameloop="always"
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-4, -2, 2]} intensity={0.4} color="#14e0cc" />
      <Suspense fallback={null}>
        <Environment preset={lowPower ? 'apartment' : 'studio'} background={false} />
        <Orb />
        <Shards />
      </Suspense>
    </Canvas>
  );
}
