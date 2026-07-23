import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { clamp, float, mix, normalWorld, smoothstep, vec3 } from 'three/tsl'

/**
 * Bakes a small procedural night-sky scene into a PMREM and assigns it as
 * `scene.environment`. This gives physical materials (the mothership's
 * clearcoat hull, metal towers) real image-based specular reflections
 * instead of flat direct-light-only highlights — the single biggest lever
 * for reading as "physically lit" rather than "game-engine flat".
 */
export function Environment() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    let disposed = false
    const generator = new THREE.PMREMGenerator(gl)

    const envScene = new THREE.Scene()
    // Sky dome: dark navy horizon rising to near-black zenith, faint teal
    // bounce near the ground to match the aurora/city glow.
    const domeMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide })
    const h = clamp(normalWorld.y.mul(0.5).add(0.5), float(0), float(1))
    const zenith = vec3(0.01, 0.012, 0.03)
    const horizon = vec3(0.05, 0.07, 0.12)
    const ground = vec3(0.02, 0.05, 0.045)
    const low = mix(ground, horizon, smoothstep(float(0.0), float(0.35), h))
    domeMat.colorNode = mix(low, zenith, smoothstep(float(0.35), float(1.0), h))
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), domeMat)
    envScene.add(dome)

    // Moon — bright disc so the metal hull picks up a real specular glint.
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 16, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4.3, 5) }),
    )
    const moonDir = new THREE.Vector3(-250, 165, -420).normalize().multiplyScalar(48)
    moon.position.copy(moonDir)
    envScene.add(moon)

    // fromScene requires the backend to be initialized; App awaits
    // renderer.init() before mount, so this is safe here.
    const rt = generator.fromScene(envScene, 0.02, 0.1, 100)
    if (!disposed) {
      scene.environment = rt.texture
      scene.environmentIntensity = 0.55
    }

    return () => {
      disposed = true
      dome.geometry.dispose()
      ;(dome.material as THREE.Material).dispose()
      moon.geometry.dispose()
      moon.material.dispose()
      generator.dispose()
      scene.environment = null
    }
  }, [gl, scene])

  return null
}
