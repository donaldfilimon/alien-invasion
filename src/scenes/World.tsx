import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { Sky } from './Sky'
import { City } from './City'
import { Mothership } from './Mothership'
import { Observatory } from './Observatory'
import { Environment } from './Environment'
import { useCinematic } from '../state/cinematic'
import { alliance, mulberry32 } from '../timeline/tracks'

function makeBlobTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.32)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

/** Soft sprite clouds — WebGPU-safe replacement for drei's GLSL clouds. */
function CloudDeck() {
  const tex = useMemo(makeBlobTexture, [])
  const group = useRef<THREE.Group>(null)
  const seats = useMemo(() => {
    const rand = mulberry32(555)
    return Array.from({ length: 20 }, (_, i) => ({
      x: (rand() - 0.5) * 520,
      y: 112 + rand() * 60,
      z: -40 - rand() * 240 + (i % 3) * 60,
      s: 70 + rand() * 100,
      o: 0.14 + rand() * 0.16,
      drift: 0.4 + rand(),
    }))
  }, [])

  useFrame(() => {
    const t = useCinematic.getState().t
    group.current?.children.forEach((spr, i) => {
      spr.position.x = seats[i].x + Math.sin(t * 0.05 * seats[i].drift + i * 2.3) * 12
    })
  })

  return (
    <group ref={group}>
      {seats.map((s, i) => (
        <sprite key={i} position={[s.x, s.y, s.z]} scale={[s.s * 1.9, s.s, 1]}>
          <spriteMaterial map={tex} color="#28304f" transparent opacity={s.o} depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

/** Composes the whole continuous world the camera flies through. */
export function World() {
  const fogRef = useRef<THREE.Fog>(null)
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const tmp = useMemo(() => new THREE.Color(), [])

  // Alliance teal targets for the atmosphere (fog + ambient + hemi)
  const fogBase = useMemo(() => new THREE.Color('#04050c'), [])
  const fogTeal = useMemo(() => new THREE.Color('#0a1a1e'), [])
  const ambBase = useMemo(() => new THREE.Color('#7f95c9'), [])
  const ambTeal = useMemo(() => new THREE.Color('#9fe8d8'), [])
  const hemiSkyBase = useMemo(() => new THREE.Color('#1d2b50'), [])
  const hemiSkyTeal = useMemo(() => new THREE.Color('#2a6a5a'), [])
  const hemiGroundBase = useMemo(() => new THREE.Color('#05060c'), [])
  const hemiGroundTeal = useMemo(() => new THREE.Color('#06181a'), [])

  useFrame(() => {
    const a = alliance(useCinematic.getState().t)
    if (fogRef.current) fogRef.current.color.copy(tmp.copy(fogBase).lerp(fogTeal, a))
    if (ambientRef.current) ambientRef.current.color.copy(tmp.copy(ambBase).lerp(ambTeal, a))
    if (hemiRef.current) {
      hemiRef.current.color.copy(tmp.copy(hemiSkyBase).lerp(hemiSkyTeal, a))
      hemiRef.current.groundColor.copy(tmp.copy(hemiGroundBase).lerp(hemiGroundTeal, a))
    }
  })

  return (
    <group>
      <fog ref={fogRef} attach="fog" args={['#04050c', 120, 900]} />
      <color attach="background" args={['#02030a']} />

      <ambientLight ref={ambientRef} intensity={0.1} color="#7f95c9" />
      <hemisphereLight ref={hemiRef} args={['#1d2b50', '#05060c', 0.4]} />
      {/* Moonlight — the key light, casting real shadows over the city. */}
      <directionalLight
        position={[-250, 165, -420]}
        intensity={0.75}
        color="#b8c8e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-180}
        shadow-camera-right={180}
        shadow-camera-top={180}
        shadow-camera-bottom={-180}
        shadow-camera-near={10}
        shadow-camera-far={1100}
        shadow-bias={-0.0004}
      />

      <Environment />
      <Sky />
      <City />
      <Observatory />
      <Mothership />
      <CloudDeck />
    </group>
  )
}
