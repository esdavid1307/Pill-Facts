import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { Point } from './composition'

/**
 * The capsule at the centre of the landing composition.
 *
 * This module is the only thing in the app that imports three.js, and it is only ever
 * reached through a dynamic import, so the ~150KB it costs lands in a chunk that the
 * landing paints without waiting for. Nothing outside it knows three.js exists; the caller
 * gets two projected points per frame and a way to tear the scene down.
 */
export type Pill = { dispose(): void }

/** Even arc-length spacing along the profile, so the imprint's UVs are not stretched. */
const STEP = 0.02
const RADIUS = 0.5
const CAP_RADIUS = 0.518

/** A lathe profile: a straight tube with a hemispherical dome on one end. */
function profile(radius: number, yEdge: number, yEnd: number, dome: 1 | -1) {
  const tubeLength = Math.abs(yEnd - yEdge)
  const arc = (Math.PI * radius) / 2
  const tubeSteps = Math.max(2, Math.round(tubeLength / STEP))
  const arcSteps = Math.round(arc / STEP)

  const cap: THREE.Vector2[] = []
  for (let i = 0; i <= arcSteps; i++) {
    const angle = (i / arcSteps) * (Math.PI / 2)
    cap.push(new THREE.Vector2(Math.cos(angle) * radius, yEnd + dome * Math.sin(angle) * radius))
  }
  const tube: THREE.Vector2[] = []
  for (let i = 0; i <= tubeSteps; i++) {
    tube.push(new THREE.Vector2(radius, yEdge + (yEnd - yEdge) * (i / tubeSteps)))
  }

  return dome > 0 ? tube.concat(cap.slice(1)) : cap.reverse().concat(tube.reverse().slice(1))
}

/** Fine greyscale noise, used as a bump map for the gelatin surface. */
function grain(size: number, low: number, high: number) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const image = context.createImageData(size, size)
  for (let i = 0; i < image.data.length; i += 4) {
    const value = low + Math.random() * (high - low)
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value
    image.data[i + 3] = 255
  }
  context.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 3)
  return texture
}

/** "PF 20" printed twice around the body's circumference. A fictional imprint. */
function imprint(bodyProfile: THREE.Vector2[]) {
  const width = 2048
  const height = 512
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  context.fillStyle = '#f2efe9'
  context.fillRect(0, 0, width, height)

  let total = 0
  for (let i = 1; i < bodyProfile.length; i++) {
    total += bodyProfile[i].distanceTo(bodyProfile[i - 1])
  }
  const along = (y: number) => {
    let walked = 0
    for (let i = 1; i < bodyProfile.length; i++) {
      walked += bodyProfile[i].distanceTo(bodyProfile[i - 1])
      const onTube = bodyProfile[i].x > RADIUS - 1e-3 && bodyProfile[i - 1].x > RADIUS - 1e-3
      if (bodyProfile[i].y >= y && onTube) {
        return walked / total
      }
    }
    return 0.7
  }

  const y = (1 - along(-0.24)) * height
  // The lathe's UVs are not square, so the type is squashed to match before it is drawn.
  const squash = height / total / (width / (2 * Math.PI * RADIUS))
  context.fillStyle = 'rgba(120,114,106,.55)'
  context.font = "600 96px 'Helvetica Neue', Arial, sans-serif"
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const u of [0.25, 0.75]) {
    context.save()
    context.translate(u * width, y)
    context.scale(1, squash)
    context.fillText('PF 20', 0, 0)
    context.restore()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** A soft ellipse of shadow under the pill, painted rather than cast. */
function contactShadow() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128)
  gradient.addColorStop(0, 'rgba(0,0,0,.34)')
  gradient.addColorStop(0.45, 'rgba(0,0,0,.12)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(canvas)
}

const BASE_TILT = 0.62
/** Inside NEAR the pill dodges fully, beyond FAR not at all. */
const NEAR = 110
const FAR = 260
const STRENGTH = 0.35

/**
 * Builds the scene and starts rendering. Throws where WebGL is unavailable, which the
 * caller treats as "show the flat pill instead".
 *
 * @param onAnchors called each frame with the two silhouette points the leader lines
 *   attach to, in composition coordinates.
 */
export function mountPill(canvas: HTMLCanvasElement, onAnchors: (points: [Point, Point]) => void): Pill {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  scene.environment = pmrem.fromScene(room, 0.04).texture
  room.dispose()

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)

  const bodyProfile = profile(RADIUS, 0.16, -0.62, -1)
  const bodyGeometry = new THREE.LatheGeometry(bodyProfile, 128)
  const capGeometry = new THREE.LatheGeometry(profile(CAP_RADIUS, -0.06, 0.62, 1), 128)

  const bump = grain(256, 110, 146)
  const printed = imprint(bodyProfile)
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    map: printed,
    color: 0xffffff,
    roughness: 0.42,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    sheen: 0.4,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffffff),
    bumpMap: bump,
    bumpScale: 0.35,
    side: THREE.DoubleSide,
  })
  const capMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xa51f0d,
    roughness: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    bumpMap: bump,
    bumpScale: 0.2,
    side: THREE.DoubleSide,
  })

  // tilt carries the pose the cursor pushes around; spin rolls the pill on its long axis.
  const tilt = new THREE.Group()
  const spin = new THREE.Group()
  spin.add(new THREE.Mesh(bodyGeometry, bodyMaterial), new THREE.Mesh(capGeometry, capMaterial))
  tilt.add(spin)
  scene.add(tilt)

  const shadowTexture = contactShadow()
  const shadowGeometry = new THREE.PlaneGeometry(2.6, 1.3)
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
  })
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -1.3
  scene.add(shadow)

  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(-3, 4, 5)
  const rim = new THREE.DirectionalLight(0xffffff, 0.8)
  rim.position.set(4, 1, -3)
  scene.add(key, rim)

  let width = 1
  let height = 1
  const resize = () => {
    width = Math.max(1, canvas.clientWidth)
    height = Math.max(1, canvas.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const size = 2.4
    const distance = Math.max(size / 0.5 / 2 / half, size / 0.36 / 2 / half / camera.aspect)
    camera.position.set(0, 0.5, distance)
    camera.lookAt(0, -0.05, 0)
    camera.updateProjectionMatrix()
  }
  resize()

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches

  /*
   * The pill stays where it is and turns: rather than fleeing the cursor across the
   * composition, it swings its nearest end away, which keeps it centred and keeps the
   * leader lines short.
   */
  const pointer = { x: 0, y: 0, active: false }
  const onMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    pointer.x = (event.clientX - rect.left) * (width / rect.width)
    pointer.y = (event.clientY - rect.top) * (height / rect.height)
    pointer.active = true
  }
  const onLeave = () => {
    pointer.active = false
  }

  const centre = new THREE.Vector3()
  const dodgeTarget = () => {
    if (!pointer.active) {
      return 0
    }
    centre.set(0, 0, 0).applyMatrix4(tilt.matrixWorld).project(camera)
    const x = (centre.x * 0.5 + 0.5) * width
    const y = (-centre.y * 0.5 + 0.5) * height
    const dx = pointer.x - x
    const dy = -(pointer.y - y)
    const distance = Math.hypot(dx, dy)
    if (distance > FAR) {
      return 0
    }
    const fall = distance < NEAR ? 1 : 1 - (distance - NEAR) / (FAR - NEAR)
    // The long axis is symmetric, so the angle to it only matters modulo pi.
    let offset = Math.atan2(dy, dx) - (BASE_TILT + Math.PI / 2)
    offset = ((((offset + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2
    const push = Math.PI / 2 - Math.abs(offset)
    return -(offset >= 0 ? 1 : -1) * push * STRENGTH * fall * fall * (3 - 2 * fall)
  }

  // The two points on the silhouette the leader lines land on, in the tilt group's space.
  const anchors = [new THREE.Vector3(-CAP_RADIUS, 0.5, 0), new THREE.Vector3(0.48, -0.76, 0)]
  const projected = new THREE.Vector3()
  const project = (anchor: THREE.Vector3): Point => {
    projected.copy(anchor).applyMatrix4(tilt.matrixWorld).project(camera)
    return { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height }
  }

  const started = performance.now()
  let dodge = 0
  let running = true
  let pending = 0

  const frame = () => {
    const time = still ? 0 : (performance.now() - started) / 1000
    // Eased rather than snapped, so the pill leans away instead of flinching.
    dodge += (dodgeTarget() - dodge) * 0.045
    tilt.rotation.set(0.28, 0, BASE_TILT + dodge + Math.sin(time * 0.5) * 0.03)
    spin.rotation.y = time * 0.35
    tilt.updateMatrixWorld()
    renderer.render(scene, camera)
    onAnchors([project(anchors[0]), project(anchors[1])])
    if (running && !still) {
      pending = requestAnimationFrame(frame)
    }
  }

  const redraw = () => {
    resize()
    if (still) {
      frame()
    }
  }

  addEventListener('resize', redraw)
  if (!still) {
    addEventListener('pointermove', onMove)
    document.addEventListener('pointerleave', onLeave)
  }
  frame()

  return {
    dispose() {
      running = false
      cancelAnimationFrame(pending)
      removeEventListener('resize', redraw)
      removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      bodyGeometry.dispose()
      capGeometry.dispose()
      shadowGeometry.dispose()
      bodyMaterial.dispose()
      capMaterial.dispose()
      shadowMaterial.dispose()
      bump.dispose()
      printed.dispose()
      shadowTexture.dispose()
      scene.environment?.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
