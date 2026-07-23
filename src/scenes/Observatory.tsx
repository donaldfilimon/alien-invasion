import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useCinematic } from '../state/cinematic'
import { ramp } from '../timeline/tracks'

/** A silhouetted observatory on a hill east of the city — Scene 1's anchor. */
export function Observatory() {
  const slitMat = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    if (!slitMat.current) return
    const t = useCinematic.getState().t
    // Gentle slit flicker while the astronomer watches, dimming once the
    // mothership arrives and the city's attention turns skyward.
    const flicker = 0.78 + 0.14 * Math.sin(t * 11.3) * Math.sin(t * 4.1 + 1)
    const dim = 1 - ramp(t, 30, 40) * 0.5
    slitMat.current.opacity = 0.85 * Math.max(flicker, 0.05) * dim
  })

  return (
    <group position={[120, 0, 90]}>
      {/* Hill */}
      <mesh position={[0, 7, 0]} castShadow receiveShadow>
        <coneGeometry args={[34, 18, 24]} />
        <meshStandardMaterial color="#0a0c14" roughness={1} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 17.5, 0]} castShadow>
        <cylinderGeometry args={[7.5, 8.5, 5, 24]} />
        <meshStandardMaterial color="#12141f" roughness={0.9} />
      </mesh>
      {/* Dome */}
      <mesh position={[0, 20, 0]} castShadow>
        <sphereGeometry args={[7.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#161a28" roughness={0.7} metalness={0.4} />
      </mesh>
      {/* Dome slit glow */}
      <mesh position={[0, 23.5, 2.5]} rotation={[0.5, 0, 0]}>
        <planeGeometry args={[1.6, 6]} />
        <meshBasicMaterial
          ref={slitMat}
          color="#ffd9a0"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Porch light */}
      <pointLight position={[0, 19, 6]} color="#ffc890" intensity={60} distance={30} decay={2} />
    </group>
  )
}
