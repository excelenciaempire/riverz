'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sparkles } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

export function FinalScene() {
  return (
    <Canvas gl={{ antialias: true, alpha: true }} dpr={[1, 1.6]} camera={{ position: [0, 0, 6], fov: 40 }}>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#14E0CC" />
      <pointLight position={[-5, -2, 4]} intensity={0.8} color="#A78BFA" />
      <Float speed={1.5} rotationIntensity={0.6} floatIntensity={0.6}>
        <Blob />
      </Float>
      <Sparkles count={120} scale={[12, 8, 8]} size={1.6} speed={0.25} color="#14E0CC" />
    </Canvas>
  );
}

function Blob() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.15;
    ref.current.rotation.x += dt * 0.06;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.6, 64]} />
      <MeshDistortMaterial
        color="#0a0a0a"
        roughness={0.2}
        metalness={0.85}
        distort={0.55}
        speed={1.6}
        envMapIntensity={1.4}
      />
    </mesh>
  );
}
