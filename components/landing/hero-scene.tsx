'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sparkles, ContactShadows } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * Escena 3D cinemática del Hero — esfera con distorsión orgánica, anillos
 * orbitales con instancias y partículas. La cámara y la rotación se mueven
 * con el scroll de la página (sin scroll capture: usa el scroll global de Lenis).
 */
export function HeroScene() {
  return (
    <Canvas
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.6]}
      camera={{ position: [0, 0, 6], fov: 38 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.35} />
      <pointLight position={[5, 4, 5]} intensity={1.2} color="#14E0CC" />
      <pointLight position={[-5, -2, 3]} intensity={1.1} color="#A78BFA" />
      <pointLight position={[0, 6, -4]} intensity={0.8} color="#F472B6" />

      {/* Núcleo orgánico distorsionado */}
      <Float speed={1.4} rotationIntensity={0.6} floatIntensity={0.8}>
        <mesh>
          <icosahedronGeometry args={[1.25, 64]} />
          <MeshDistortMaterial
            color="#0a0a0a"
            roughness={0.18}
            metalness={0.7}
            distort={0.42}
            speed={2.2}
            envMapIntensity={1.2}
          />
        </mesh>
        {/* Capa exterior de cristal con fresnel */}
        <mesh scale={1.18}>
          <icosahedronGeometry args={[1.25, 32]} />
          <meshPhysicalMaterial
            color="#14E0CC"
            transparent
            opacity={0.18}
            roughness={0}
            metalness={0}
            transmission={0.95}
            thickness={0.4}
            ior={1.4}
            attenuationColor="#A78BFA"
            attenuationDistance={3}
          />
        </mesh>
      </Float>

      {/* Anillos orbitales con instancias 3D reales */}
      <OrbitalRing radius={2.2} count={6}  hue="#14E0CC" tilt={0}     speed={0.18} />
      <OrbitalRing radius={2.7} count={5}  hue="#A78BFA" tilt={0.7}   speed={-0.14} />
      <OrbitalRing radius={3.3} count={7}  hue="#F472B6" tilt={-0.4}  speed={0.10} />

      {/* Halo ambient — partículas */}
      <Sparkles count={120} scale={[8, 8, 8]} size={2.4} speed={0.35} color="#14E0CC" />
      <Sparkles count={80}  scale={[10, 6, 8]} size={1.6} speed={0.25} color="#A78BFA" opacity={0.6} />

      <ContactShadows position={[0, -1.8, 0]} opacity={0.4} scale={8} blur={2.4} far={4} />

      <SceneSpin />
    </Canvas>
  );
}

function SceneSpin() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.06;
    // sutil oscilación con el tiempo
    ref.current.rotation.x = Math.sin(performance.now() * 0.0002) * 0.08;
  });
  return <group ref={ref} />;
}

function OrbitalRing({
  radius,
  count,
  hue,
  tilt,
  speed,
}: {
  radius: number;
  count: number;
  hue: string;
  tilt: number;
  speed: number;
}) {
  const group = useRef<THREE.Group>(null);
  const items = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        angle: (i / count) * Math.PI * 2,
      })),
    [count]
  );

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * speed;
  });

  return (
    <group rotation={[tilt, 0, 0]}>
      {/* Anillo etéreo */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.012, radius + 0.012, 128]} />
        <meshBasicMaterial color={hue} transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      <group ref={group}>
        {items.map((it, i) => {
          const x = Math.cos(it.angle) * radius;
          const z = Math.sin(it.angle) * radius;
          return (
            <Float key={i} speed={1.6} rotationIntensity={0.8} floatIntensity={0.4}>
              <mesh position={[x, 0, z]}>
                <octahedronGeometry args={[0.13, 0]} />
                <meshStandardMaterial
                  color={hue}
                  emissive={hue}
                  emissiveIntensity={0.85}
                  roughness={0.25}
                  metalness={0.6}
                />
              </mesh>
            </Float>
          );
        })}
      </group>
    </group>
  );
}
