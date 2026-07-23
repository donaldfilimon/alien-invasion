import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useCinematic } from '../state/cinematic'
import { env, mulberry32, ramp } from '../timeline/tracks'

interface Building {
  x: number
  z: number
  w: number
  d: number
  h: number
}

const PLAZA_RADIUS = 16
const dummy = new THREE.Object3D()

function generateBuildings(): Building[] {
  const rand = mulberry32(1337)
  const buildings: Building[] = []
  for (let gx = -84; gx <= 84; gx += 8) {
    for (let gz = -84; gz <= 84; gz += 8) {
      if (Math.hypot(gx, gz) < PLAZA_RADIUS) continue
      if (rand() < 0.18) continue // empty lots
      const centerBias = 1 - Math.min(Math.hypot(gx, gz) / 120, 1)
      const h = 4 + rand() * 10 + centerBias * centerBias * rand() * 34
      buildings.push({
        x: gx + (rand() - 0.5) * 2,
        z: gz + (rand() - 0.5) * 2,
        w: 4 + rand() * 2.5,
        d: 4 + rand() * 2.5,
        h,
      })
    }
  }
  return buildings
}

interface WindowPane {
  x: number
  y: number
  z: number
  ry: number
}

/**
 * Windows as oriented facade quads (instanced). WebGPU renders Points at a
 * fixed 1px, so sized point sprites are not an option there.
 */
function generateWindows(buildings: Building[]): WindowPane[] {
  const rand = mulberry32(9001)
  const panes: WindowPane[] = []
  for (const b of buildings) {
    const floors = Math.floor(b.h / 2.4)
    for (let f = 1; f < floors; f++) {
      const y = f * 2.4
      for (let i = 0; i < 4; i++) {
        if (rand() < 0.45) continue
        const side = Math.floor(rand() * 4)
        const off = (rand() - 0.5) * (side < 2 ? b.w : b.d) * 0.8
        if (side === 0) panes.push({ x: b.x + off, y, z: b.z + b.d / 2 + 0.06, ry: 0 })
        else if (side === 1) panes.push({ x: b.x + off, y, z: b.z - b.d / 2 - 0.06, ry: Math.PI })
        else if (side === 2) panes.push({ x: b.x + b.w / 2 + 0.06, y, z: b.z + off, ry: Math.PI / 2 })
        else panes.push({ x: b.x - b.w / 2 - 0.06, y, z: b.z + off, ry: -Math.PI / 2 })
      }
    }
  }
  return panes
}

function generateStreetlights(): [number, number, number][] {
  const rand = mulberry32(2024)
  const pts: [number, number, number][] = []
  for (let gx = -84; gx <= 84; gx += 16) {
    for (let gz = -84; gz <= 84; gz += 16) {
      if (Math.hypot(gx + 4, gz + 4) < PLAZA_RADIUS) continue
      if (rand() < 0.2) continue
      pts.push([gx + 4 + (rand() - 0.5) * 3, 3.4, gz + 4 + (rand() - 0.5) * 3])
    }
  }
  return pts
}

/** The city: instanced towers, glowing windows, streetlights, searchlights. */
export function City() {
  const windowsMat = useRef<THREE.MeshBasicMaterial>(null)
  const windowsRef = useRef<THREE.InstancedMesh>(null)
  const lampsRef = useRef<THREE.InstancedMesh>(null)
  const searchGroup = useRef<THREE.Group>(null)
  const buildingsRef = useRef<THREE.InstancedMesh>(null)

  const buildings = useMemo(generateBuildings, [])
  const windows = useMemo(() => generateWindows(buildings), [buildings])
  const lamps = useMemo(generateStreetlights, [])

  const warmColor = useMemo(() => new THREE.Color('#ffb46b'), [])
  const allianceColor = useMemo(() => new THREE.Color('#7dffd0'), [])
  const tmpColor = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    const t = useCinematic.getState().t
    if (buildingsRef.current && !buildingsRef.current.userData.filled) {
      const rand = mulberry32(31415)
      const c = new THREE.Color()
      buildings.forEach((b, i) => {
        dummy.position.set(b.x, b.h / 2, b.z)
        dummy.scale.set(b.w, b.h, b.d)
        dummy.updateMatrix()
        buildingsRef.current!.setMatrixAt(i, dummy.matrix)
        // Concrete / glass / slate variation
        const kind = rand()
        if (kind < 0.55) c.setHSL(0.63, 0.18, 0.05 + rand() * 0.03)
        else if (kind < 0.85) c.setHSL(0.58, 0.3, 0.07 + rand() * 0.04)
        else c.setHSL(0.08, 0.08, 0.06 + rand() * 0.02)
        buildingsRef.current!.setColorAt(i, c)
      })
      buildingsRef.current.instanceMatrix.needsUpdate = true
      if (buildingsRef.current.instanceColor) buildingsRef.current.instanceColor.needsUpdate = true
      buildingsRef.current.userData.filled = true
    }

    if (windowsRef.current && !windowsRef.current.userData.filled) {
      windows.forEach((w, i) => {
        dummy.position.set(w.x, w.y, w.z)
        dummy.rotation.set(0, w.ry, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        windowsRef.current!.setMatrixAt(i, dummy.matrix)
      })
      dummy.rotation.set(0, 0, 0)
      windowsRef.current.instanceMatrix.needsUpdate = true
      windowsRef.current.userData.filled = true
    }

    if (lampsRef.current && !lampsRef.current.userData.filled) {
      lamps.forEach((p, i) => {
        dummy.position.set(p[0], p[1], p[2])
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        lampsRef.current!.setMatrixAt(i, dummy.matrix)
      })
      lampsRef.current.instanceMatrix.needsUpdate = true
      lampsRef.current.userData.filled = true
    }

    if (windowsMat.current) {
      // Panic: city-wide flicker. Alliance: windows shift toward teal.
      const panic = env(t, 35, 37, 48, 51)
      const flicker =
        1 - panic * (0.55 + 0.45 * Math.sin(t * 31) * Math.sin(t * 17.3) * Math.sin(t * 7.1))
      windowsMat.current.opacity = 0.9 * Math.max(flicker, 0.08)
      const blend = ramp(t, 80, 86)
      windowsMat.current.color.copy(tmpColor.copy(warmColor).lerp(allianceColor, blend))
    }

    if (searchGroup.current) {
      const panic = env(t, 35, 37, 49, 52)
      searchGroup.current.visible = panic > 0.01
      searchGroup.current.children.forEach((cone, i) => {
        cone.rotation.y = t * (0.5 + i * 0.23) + i * 2.1
        const mesh = (cone as THREE.Group).children[0] as THREE.Mesh
        ;(mesh.material as THREE.MeshBasicMaterial).opacity = 0.08 * panic
      })
    }
  })

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[1600, 1600]} />
        <meshStandardMaterial color="#07080f" roughness={0.85} metalness={0.25} />
      </mesh>

      {/* Plaza disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[PLAZA_RADIUS - 2, 48]} />
        <meshStandardMaterial color="#0c0e18" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Towers — instance colors carry the per-building tint */}
      <instancedMesh
        ref={buildingsRef}
        args={[undefined, undefined, buildings.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} metalness={0.35} />
      </instancedMesh>

      {/* Lit windows — instanced facade quads */}
      <instancedMesh ref={windowsRef} args={[undefined, undefined, windows.length]}>
        <planeGeometry args={[0.85, 0.6]} />
        <meshBasicMaterial
          ref={windowsMat}
          color="#ffb46b"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      {/* Sodium streetlights along the grid */}
      <instancedMesh ref={lampsRef} args={[undefined, undefined, lamps.length]}>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshBasicMaterial color="#ff9440" transparent opacity={0.9} />
      </instancedMesh>

      {/* Searchlights during Panic */}
      <group ref={searchGroup}>
        {[
          [-45, 0, 30],
          [50, 0, -40],
          [-20, 0, -60],
        ].map((p, i) => (
          <group key={i} position={p as [number, number, number]}>
            <mesh position={[0, 45, 0]} rotation={[0.35, 0, 0.12]}>
              <coneGeometry args={[14, 90, 24, 1, true]} />
              <meshBasicMaterial
                color="#a9c4e8"
                transparent
                opacity={0.08}
                side={THREE.DoubleSide}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
