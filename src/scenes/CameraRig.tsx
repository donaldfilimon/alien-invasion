import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useCinematic } from '../state/cinematic'
import { sampleCamera } from '../timeline/tracks'

/**
 * Drives the camera from the keyframe track every frame, and advances the
 * master clock. Everything on screen derives from the same `t`.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const pos = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    const { tick, t } = useCinematic.getState()
    tick(Math.min(delta, 0.1))

    const fov = sampleCamera(t, pos.current, look.current)
    // Subtle handheld drift so static shots still breathe
    const sway = 0.6
    pos.current.x += Math.sin(t * 0.31) * sway
    pos.current.y += Math.sin(t * 0.43 + 1.7) * sway * 0.5
    camera.position.copy(pos.current)
    camera.lookAt(look.current)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
