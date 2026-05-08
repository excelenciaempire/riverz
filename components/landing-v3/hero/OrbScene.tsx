'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getHeroProgress } from './useScrollProgress';

/**
 * The Riverz Orb — a glassy sphere with three colored shards inside that
 * emerge and orbit outward as the user scrolls the hero.
 *
 * This intentionally uses ONLY three.js core primitives (no drei). drei's
 * MeshTransmissionMaterial / Environment / Float are gorgeous but their
 * production-bundle behavior under SWC mangle has produced TDZ crashes,
 * which we cannot afford on the public landing. Built-in
 * meshPhysicalMaterial with transmission gives ~80% of the effect with
 * zero runtime risk.
 */

function Orb() {
  const meshRef = useRef<THREE.Mesh>(null);
  const start = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);

  useFrame((_, delta) => {
    const m = meshRef.current;
    if (!m) return;
    const p = getHeroProgress();
    const scale = 1 - p * 0.55;
    m.scale.setScalar(scale);
    // Slight float without drei's <Float>.
    const t = (typeof performance !== 'undefined' ? performance.now() : 0) - start.current;
    m.position.y = -p * 0.3 + Math.sin(t * 0.0009) * 0.06;
    m.rotation.y += delta * (0.18 + p * 0.6);
    m.rotation.x = Math.sin(t * 0.0003) * 0.08;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.05, 64, 64]} />
      <meshPhysicalMaterial
        color="#ffffff"
        roughness={0.08}
        metalness={0.1}
        transmission={0.92}
        thickness={0.5}
        ior={1.42}
        clearcoat={1}
        clearcoatRoughness={0.05}
        attenuationColor="#fff7d6"
        attenuationDistance={1.6}
      />
    </mesh>
  );
}

interface ShardProps {
  finalPosition: [number, number, number];
  finalRotation: [number, number, number];
  color: string;
  startAt: number;
}

function Shard({ finalPosition, finalRotation, color, startAt }: ShardProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const m = meshRef.current;
    if (!m) return;
    const p = getHeroProgress();
    const local = Math.min(1, Math.max(0, (p - startAt) / (1 - startAt)));
    const eased = local * local * (3 - 2 * local);

    m.position.x = finalPosition[0] * eased;
    m.position.y = finalPosition[1] * eased;
    m.position.z = finalPosition[2] * eased;
    m.rotation.x = finalRotation[0] * eased;
    m.rotation.y = finalRotation[1] * eased;
    m.rotation.z = finalRotation[2] * eased;
    m.scale.setScalar(0.05 + eased * 0.95);

    const mat = m.material as THREE.MeshStandardMaterial;
    mat.opacity = eased;
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
      {/* Three-light setup tuned to evoke a studio HDRI. */}
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#f5f3ec', 0.6]} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-4, -2, 2]} intensity={0.6} color="#14e0cc" />
      <directionalLight position={[0, -3, -5]} intensity={0.4} color="#f7ff9e" />
      <Orb />
      <Shards />
    </Canvas>
  );
}
