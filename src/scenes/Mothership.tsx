import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCinematic } from '../state/cinematic'
import { SHIP_ALTITUDE, env, mulberry32, ramp, sampleScalar } from '../timeline/tracks'

const RIM_LIGHTS = 28
const FLEET_SIZE = 42
const dummy = new THREE.Object3D()

/** The mothership, its descent, the hologram, and the fleet reveal. */
export function Mothership() {
  const ship = useRef<THREE.Group>(null)
  const rimRing = useRef<THREE.Group>(null)
  const underglow = useRef<THREE.MeshBasicMaterial>(null)
  const holoGroup = useRef<THREE.Group>(null)
  const beamMat = useRef<THREE.MeshBasicMaterial>(null)
  const alienMat = useRef<THREE.MeshBasicMaterial>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const alien = useRef<THREE.Group>(null)
  const fleet = useRef<THREE.InstancedMesh>(null)
  const fleetMat = useRef<THREE.MeshBasicMaterial>(null)

  const rimPositions = useMemo(() => {
    const arr: [number, number, number][] = []
    for (let i = 0; i < RIM_LIGHTS; i++) {
      const a = (i / RIM_LIGHTS) * Math.PI * 2
      arr.push([Math.cos(a) * 33, -1.5, Math.sin(a) * 33])
    }
    return arr
  }, [])

  const fleetSeats = useMemo(() => {
    const rand = mulberry32(4242)
    const seats: { pos: THREE.Vector3; scale: number }[] = []
    for (let i = 0; i < FLEET_SIZE; i++) {
      const angle = rand() * Math.PI * 2
      const dist = 160 + rand() * 420
      seats.push({
        pos: new THREE.Vector3(
          Math.cos(angle) * dist,
          110 + rand() * 190,
          Math.sin(angle) * dist - 120,
        ),
        scale: 3 + rand() * 7,
      })
    }
    return seats
  }, [])

  useFrame(() => {
    const t = useCinematic.getState().t

    if (ship.current) {
      const y = sampleScalar(SHIP_ALTITUDE, t) + Math.sin(t * 0.8) * 1.4 * ramp(t, 33, 36)
      ship.current.position.set(0, y, 0)
      ship.current.rotation.y = t * 0.05
    }
    if (rimRing.current) rimRing.current.rotation.y = t * 0.6

    if (underglow.current) {
      const contact = env(t, 49, 51, 64, 66)
      underglow.current.opacity = 0.12 + 0.16 * contact + 0.04 * Math.sin(t * 4)
    }

    // Hologram lives during First Contact (50–65)
    const holo = env(t, 50, 52.5, 62.5, 65)
    if (holoGroup.current) holoGroup.current.visible = holo > 0.01
    if (beamMat.current) beamMat.current.opacity = 0.09 * holo
    if (alienMat.current) alienMat.current.opacity = 0.9 * holo
    if (ringMat.current) ringMat.current.opacity = 0.5 * holo
    if (alien.current) {
      alien.current.rotation.y = t * 0.5
      alien.current.position.y = 8 + Math.sin(t * 1.5) * 0.6
    }

    // Fleet fades in for The Truth (65+)
    const reveal = ramp(t, 65, 71)
    if (fleet.current) {
      fleet.current.visible = reveal > 0.01
      if (!fleet.current.userData.filled) {
        fleetSeats.forEach((s, i) => {
          dummy.position.copy(s.pos)
          dummy.scale.set(s.scale, s.scale * 0.35, s.scale)
          dummy.updateMatrix()
          fleet.current!.setMatrixAt(i, dummy.matrix)
        })
        fleet.current.instanceMatrix.needsUpdate = true
        fleet.current.userData.filled = true
      }
    }
    if (fleetMat.current) {
      // Alliance: fleet lights warm from cold blue to teal-green
      fleetMat.current.opacity = reveal
      fleetMat.current.color.setHSL(0.5 + ramp(t, 80, 86) * 0.12, 0.9, 0.72)
    }
  })

  return (
    <group>
      <group ref={ship}>
        {/* Hull — clearcoated alien alloy */}
        <mesh castShadow>
          <cylinderGeometry args={[24, 35, 9, 64]} />
          <meshPhysicalMaterial
            color="#1a2030"
            roughness={0.32}
            metalness={0.95}
            clearcoat={1}
            clearcoatRoughness={0.25}
          />
        </mesh>
        {/* Dome */}
        <mesh position={[0, 4.5, 0]} castShadow>
          <sphereGeometry args={[13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial
            color="#2a3550"
            emissive="#40608a"
            emissiveIntensity={0.5}
            roughness={0.15}
            metalness={0.85}
            clearcoat={0.8}
            clearcoatRoughness={0.2}
          />
        </mesh>
        {/* Rotating rim lights */}
        <group ref={rimRing}>
          {rimPositions.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.9, 8, 8]} />
              <meshBasicMaterial color={i % 3 === 0 ? '#8df7ff' : '#4aa8ff'} />
            </mesh>
          ))}
        </group>
        {/* Underglow */}
        <mesh position={[0, -4.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[22, 48]} />
          <meshBasicMaterial
            ref={underglow}
            color="#66f6e0"
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* Light cast on the city below */}
        <pointLight position={[0, -12, 0]} color="#5fe8d0" intensity={900} distance={140} decay={1.6} />
      </group>

      {/* Hologram beam + alien emissary at the plaza */}
      <group ref={holoGroup}>
        <mesh position={[0, 28, 0]}>
          <cylinderGeometry args={[2.5, 9, 56, 32, 1, true]} />
          <meshBasicMaterial
            ref={beamMat}
            color="#7dfff0"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <group ref={alien} position={[0, 8, 0]} scale={1.9}>
          <mesh position={[0, 0, 0]}>
            <capsuleGeometry args={[1.1, 2.6, 6, 12]} />
            <meshBasicMaterial ref={alienMat} color="#8dfff2" wireframe transparent opacity={0} />
          </mesh>
          <mesh position={[0, 2.9, 0]}>
            <sphereGeometry args={[1.5, 16, 12]} />
            <meshBasicMaterial color="#8dfff2" wireframe transparent opacity={0.9} />
          </mesh>
        </group>
        <mesh position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[6, 7.5, 48]} />
          <meshBasicMaterial
            ref={ringMat}
            color="#7dfff0"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* The fleet, revealed in The Truth */}
      <instancedMesh ref={fleet} args={[undefined, undefined, FLEET_SIZE]} visible={false}>
        <sphereGeometry args={[1, 16, 8]} />
        <meshBasicMaterial ref={fleetMat} color="#9bd8ff" transparent opacity={0} fog={false} />
      </instancedMesh>
    </group>
  )
}
