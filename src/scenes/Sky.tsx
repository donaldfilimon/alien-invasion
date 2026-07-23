import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { float, mix, sin, smoothstep, uniform, uv, vec3 } from 'three/tsl'
import { useCinematic } from '../state/cinematic'
import { mulberry32, ramp } from '../timeline/tracks'

/** 6k stars on a far shell with realistic temperature + brightness spread. */
function makeStarfield(): THREE.BufferGeometry {
  const rand = mulberry32(777)
  const N = 6000
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const c = new THREE.Color()
  for (let i = 0; i < N; i++) {
    let x = 0
    let y = -1
    let z = 0
    while (y < -0.08) {
      const u1 = rand() * 2 - 1
      const phi = rand() * Math.PI * 2
      const s = Math.sqrt(1 - u1 * u1)
      x = s * Math.cos(phi)
      y = u1
      z = s * Math.sin(phi)
    }
    const r = 620 + rand() * 140
    pos[i * 3] = x * r
    pos[i * 3 + 1] = y * r
    pos[i * 3 + 2] = z * r
    // Most stars cool blue-white, a few warm; brightness follows a power law
    const warm = rand() > 0.78
    const bright = 0.3 + Math.pow(rand(), 3.2) * 0.7
    c.setHSL(warm ? 0.08 : 0.62, (warm ? 0.5 : 0.3) * rand(), 0.8)
    col[i * 3] = c.r * bright
    col[i * 3 + 1] = c.g * bright
    col[i * 3 + 2] = c.b * bright
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

/**
 * Aurora as a TSL node material — compiles to WGSL on WebGPU and GLSL on
 * the WebGL2 fallback. Same math as the old GLSL shader, plus border fade.
 */
function makeAurora() {
  const uT = uniform(0)
  const uOp = uniform(0)
  const u = uv()
  const wave = sin(u.x.mul(14).add(uT.mul(0.7))).mul(0.5).add(0.5)
  const wave2 = sin(u.x.mul(5).sub(uT.mul(0.35))).mul(0.5).add(0.5)
  const band = smoothstep(float(0.02), wave.mul(0.25).add(0.3), u.y).mul(
    smoothstep(wave2.mul(0.3).add(0.45), float(0.95), u.y).oneMinus(),
  )
  const edge = smoothstep(float(0.0), float(0.18), u.x)
    .mul(smoothstep(float(0.82), float(1.0), u.x).oneMinus())
    .mul(smoothstep(float(0.75), float(0.98), u.y).oneMinus())
    .mul(smoothstep(float(0.0), float(0.06), u.y))

  const mat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  })
  mat.colorNode = mix(vec3(0.15, 0.95, 0.55), vec3(0.35, 0.45, 1.0), u.y.add(wave.mul(0.25)).clamp())
  mat.opacityNode = band.mul(edge).mul(uOp).mul(wave2.mul(0.4).add(0.6))
  return { mat, uT, uOp }
}

/** Stars, moon, and the aurora that ignites during the Alliance chapter. */
export function Sky() {
  const starGeom = useMemo(makeStarfield, [])
  const aurora = useMemo(makeAurora, [])

  useFrame(() => {
    const t = useCinematic.getState().t
    aurora.uT.value = t
    aurora.uOp.value = ramp(t, 78, 86) * 0.85
  })

  return (
    <group>
      <points geometry={starGeom} frustumCulled={false}>
        <pointsMaterial
          size={1.7}
          sizeAttenuation={false}
          vertexColors
          transparent
          opacity={0.95}
          depthWrite={false}
          fog={false}
        />
      </points>

      {/* Moon — HDR emissive so it feeds the bloom pass */}
      <mesh position={[-250, 165, -420]}>
        <sphereGeometry args={[26, 32, 32]} />
        <meshStandardMaterial color="#cdd7e8" emissive="#c7d4ea" emissiveIntensity={2.4} fog={false} />
      </mesh>

      {/* Aurora curtain, far behind the city */}
      <mesh position={[-80, 200, -520]} rotation={[0, 0.15, 0]}>
        <planeGeometry args={[900, 260, 1, 1]} />
        <primitive object={aurora.mat} attach="material" />
      </mesh>
    </group>
  )
}
