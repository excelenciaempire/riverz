'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Html, Line, Sparkles } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const specialists = [
  { name: 'Investigador',     role: 'Conoce tu audiencia',  hue: '#14E0CC' },
  { name: 'Estratega',        role: 'Diseña la campaña',    hue: '#22D3EE' },
  { name: 'Director Creativo', role: 'Genera las ideas',    hue: '#A78BFA' },
  { name: 'Diseñador',        role: 'Tu identidad visual',  hue: '#F472B6' },
  { name: 'Productor de Video', role: 'UGC y clips',        hue: '#F59E0B' },
  { name: 'Voz y Guion',      role: 'Habla por tu marca',   hue: '#60A5FA' },
  { name: 'Post-producción',  role: 'Listo para publicar',  hue: '#34D399' },
  { name: 'Performance',      role: 'Aprende de resultados', hue: '#FB7185' },
];

function spherePoints(n: number, radius = 2.4): [number, number, number][] {
  // Distribución de Fibonacci sobre la esfera para que los nodos no se aglomeren
  const pts: [number, number, number][] = [];
  const offset = 2 / n;
  const inc = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = i * offset - 1 + offset / 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * inc;
    pts.push([Math.cos(phi) * r * radius, y * radius, Math.sin(phi) * r * radius]);
  }
  return pts;
}

export function SpecialistsScene({ progress = 0 }: { progress?: number }) {
  return (
    <Canvas
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.6]}
      camera={{ position: [0, 0, 7.6], fov: 42 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#14E0CC" />
      <pointLight position={[-5, -3, 4]} intensity={0.9} color="#A78BFA" />
      <Constellation progress={progress} />
      <Sparkles count={140} scale={[10, 10, 10]} size={1.4} speed={0.2} color="#A78BFA" opacity={0.5} />
    </Canvas>
  );
}

function Constellation({ progress }: { progress: number }) {
  const group = useRef<THREE.Group>(null);
  const positions = useMemo(() => spherePoints(specialists.length, 2.5), []);
  const [hover, setHover] = useState<number | null>(null);
  const { camera } = useThree();

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * 0.07;
    group.current.rotation.x += dt * 0.018;
    // Cámara se acerca y orbita ligeramente con el progress (0..1)
    const z = 7.6 - progress * 2.4;
    camera.position.z += (z - camera.position.z) * 0.05;
    camera.position.x = Math.sin(progress * Math.PI * 2) * 0.6;
    camera.position.y = Math.cos(progress * Math.PI * 2) * 0.4;
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={group}>
      {/* Conexiones entre nodos */}
      {positions.map((p, i) =>
        positions.slice(i + 1).map((q, j) => {
          const distance = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
          if (distance > 3.4) return null;
          return (
            <Line
              key={`${i}-${j}`}
              points={[p, q]}
              color="#14E0CC"
              opacity={0.18}
              transparent
              lineWidth={0.6}
            />
          );
        })
      )}

      {positions.map((p, i) => {
        const s = specialists[i];
        return (
          <Float key={s.name} speed={1.4} rotationIntensity={0.4} floatIntensity={0.25}>
            <group
              position={p}
              onPointerOver={() => setHover(i)}
              onPointerOut={() => setHover(null)}
            >
              {/* Nodo: octaedro luminoso */}
              <mesh>
                <octahedronGeometry args={[0.22, 0]} />
                <meshStandardMaterial
                  color={s.hue}
                  emissive={s.hue}
                  emissiveIntensity={hover === i ? 1.5 : 0.85}
                  roughness={0.25}
                  metalness={0.7}
                />
              </mesh>
              {/* Halo */}
              <mesh>
                <sphereGeometry args={[0.32, 16, 16]} />
                <meshBasicMaterial color={s.hue} transparent opacity={hover === i ? 0.18 : 0.08} />
              </mesh>
              {/* Etiqueta HTML siempre frente a la cámara */}
              <Html
                center
                distanceFactor={8}
                position={[0, 0.5, 0]}
                style={{ pointerEvents: 'none' }}
              >
                <div
                  className="rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur"
                  style={{ color: s.hue, borderColor: `${s.hue}55` }}
                >
                  {s.name}
                </div>
              </Html>
            </group>
          </Float>
        );
      })}

      {/* Núcleo central */}
      <mesh>
        <icosahedronGeometry args={[0.7, 2]} />
        <meshStandardMaterial color="#0a0a0a" emissive="#14E0CC" emissiveIntensity={0.5} roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh scale={1.15}>
        <icosahedronGeometry args={[0.7, 2]} />
        <meshBasicMaterial color="#14E0CC" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}
