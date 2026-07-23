import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { float, mrt, normalView, output, pass, renderOutput, screenUV, smoothstep, uniform, vec3, vec4 } from 'three/tsl'
import type { Node } from 'three/webgpu'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'
import { ao } from 'three/addons/tsl/display/GTAONode.js'
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js'
import { lensflare } from 'three/addons/tsl/display/LensflareNode.js'
import { World } from './scenes/World'
import { CameraRig } from './scenes/CameraRig'
import { ScoreNode } from './audio/ScoreNode'
import { Overlay } from './ui/Overlay'
import { useCinematic, chapterAt } from './state/cinematic'
import { BOKEH_SCALE, FOCAL_LENGTH, FOCUS_DISTANCE, sampleScalar } from './timeline/tracks'

/**
 * UE5-grade TSL post chain, built once against a stable scene graph:
 *   GTAO (contact shadows from real depth/normal buffers)
 *     -> HDR bloom
 *     -> AgX tone mapping (renderOutput)
 *     -> vignette -> lens flare -> film grain
 *     -> depth-of-field (rack focus, driven by the timeline)
 *     -> FXAA
 * Replaces @react-three/postprocessing, which cannot run under WebGPURenderer.
 * Two nodes were tried and dropped after isolating each with the rest of the
 * chain stubbed out:
 *  - ChromaticAberrationNode fails to build under this three.js version's
 *    WebGPU node compiler.
 *  - GodraysNode floods the frame uniformly (its raymarch integrates over an
 *    unbounded medium against our open-sky night scene — sky pixels sit at
 *    max depth, so every pixel accumulates near-max scattering regardless of
 *    the moonlight shafts it's meant to isolate). Not just a scale problem:
 *    three tuning passes at wildly different multipliers produced the same
 *    flood, which is what a full-frame integral looks like, not "too bright".
 */
// Several TSL post-processing addons (Bloom/Film/Lensflare/ChromaticAberration)
// ship with .d.ts files that lag their JSDoc-documented runtime API in this
// three.js version — these casts bridge that gap; behavior is per the addons'
// own source-level docs, verified live in the browser.
const asVec4 = (n: unknown) => n as Node<'vec4'>

/**
 * Gate the post chain by chapter: close city/contact shots pay for GTAO
 * (Scene 2–4); wide sky shots (Scene 1, 5–7) drop it. Implemented by swapping
 * `PostProcessing.outputNode` at chapter boundaries. Trade-off: each swap is a
 * one-time WGSL recompile (a brief hitch). Flip `GATE_POST` false to revert to
 * a single always-on full chain. Needs a live browser pass to confirm the
 * hitches at Scene 1→2 and Scene 4→5 are acceptable.
 */
const GATE_POST = true
// Chapters that get the full chain (with GTAO). Everything else is "light".
const FULL_CHAIN_CHAPTERS = new Set([2, 3, 4])

interface PostRig {
  post: THREE.PostProcessing
  nodeFull: Node<'vec4'>
  nodeLight: Node<'vec4'>
  uFocusDist: ReturnType<typeof uniform>
  uFocalLen: ReturnType<typeof uniform>
  uBokeh: ReturnType<typeof uniform>
}

function Post() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const [rig, setRig] = useState<PostRig | null>(null)
  // Tracks which output node is currently bound so we only swap on change.
  const chainRef = useRef<'full' | 'light'>(GATE_POST ? 'light' : 'full')

  useEffect(() => {
    const scenePass = pass(scene, camera)
    scenePass.setMRT(mrt({ output, normal: normalView }))

    const color = scenePass.getTextureNode('output')
    const normal = scenePass.getTextureNode('normal')
    const depth = scenePass.getTextureNode('depth')
    const viewZ = scenePass.getViewZNode()

    const bloomTex = asVec4(
      (bloom(color, 0.55, 0.32, 0.42) as unknown as { getTextureNode(): unknown }).getTextureNode(),
    )

    // Shared tail: bloom -> AgX -> vignette -> lens flare -> film grain ->
    // DOF (rack focus) -> FXAA. Built twice — once fed by the GTAO-occluded
    // HDR, once by the raw HDR — so the two chains differ only in GTAO.
    const buildTail = (hdr: Node<'vec4'>) => {
      const tonemapped = renderOutput(hdr)
      const vig = float(1).sub(smoothstep(0.42, 0.98, screenUV.sub(0.5).length()).mul(0.5))
      let graded = tonemapped.mul(vig)
      const flare = asVec4(lensflare(bloomTex, { threshold: float(0.55), ghostSamples: float(5) }))
      graded = graded.add(flare.mul(0.5))
      graded = asVec4(film(graded, float(0.055)))
      return asVec4(fxaa(dof(graded, viewZ, uFocusDist, uFocalLen, uBokeh)))
    }

    const uFocusDist = uniform(260)
    const uFocalLen = uniform(240)
    const uBokeh = uniform(0.4)

    const aoTex = ao(depth, normal, camera).getTextureNode()
    const occluded = color.mul(vec4(vec3(aoTex.r), 1))
    const nodeFull = buildTail(occluded.add(bloomTex))
    const nodeLight = buildTail(color.add(bloomTex))

    const p = new THREE.PostProcessing(gl)
    p.outputColorTransform = false
    p.outputNode = GATE_POST ? nodeLight : nodeFull

    setRig({ post: p, nodeFull, nodeLight, uFocusDist, uFocalLen, uBokeh })
    return () => {
      p.dispose()
      setRig(null)
    }
  }, [gl, scene, camera])

  // Priority > 0 disables R3F's automatic render; we own the frame.
  useFrame(() => {
    if (!rig) return
    const t = useCinematic.getState().t
    rig.uFocusDist.value = sampleScalar(FOCUS_DISTANCE, t)
    rig.uFocalLen.value = sampleScalar(FOCAL_LENGTH, t)
    rig.uBokeh.value = sampleScalar(BOKEH_SCALE, t)
    if (GATE_POST) {
      const want = FULL_CHAIN_CHAPTERS.has(chapterAt(t).id) ? 'full' : 'light'
      if (want !== chainRef.current) {
        rig.post.outputNode = want === 'full' ? rig.nodeFull : rig.nodeLight
        chainRef.current = want
      }
    }
    rig.post.render()
    // First successful render ⇒ WGSL compile is done, the film is visible.
    // Lift the loading splash (set once; cheap no-op thereafter).
    const st = useCinematic.getState()
    if (!st.ready) st.setReady(true)
  }, 1)
  return null
}

/** Dev-only: lets tooling render a frame at an arbitrary time even when rAF is throttled. */
function DevDriver() {
  const advance = useThree((s) => s.advance)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as Record<string, unknown>).renderAt = (t: number) => {
      const s = useCinematic.getState()
      s.setT(t)
      if (s.playing) s.toggle()
      advance(performance.now())
      advance(performance.now() + 16)
    }
  }, [advance])
  return null
}

export default function App() {
  return (
    <div className="stage">
      <Canvas
        shadows
        camera={{ fov: 55, near: 0.1, far: 2500, position: [172, 30, 158] }}
        dpr={[1, 2]}
        gl={async (props) => {
          const renderer = new THREE.WebGPURenderer({
            ...(props as ConstructorParameters<typeof THREE.WebGPURenderer>[0]),
            antialias: true,
          })
          await renderer.init()
          renderer.toneMapping = THREE.AgXToneMapping
          renderer.toneMappingExposure = 1.2
          const backend = renderer.backend as { isWebGPUBackend?: boolean }
          useCinematic.getState().setBackend(backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2')
          return renderer
        }}
      >
        <World />
        <CameraRig />
        <ScoreNode />
        <DevDriver />
        <Post />
      </Canvas>
      <Overlay />
    </div>
  )
}
