import {
  BufferGeometry, Group, InstancedMesh, LineBasicMaterial, LineSegments,
  Matrix4, Mesh, MeshBasicMaterial, SphereGeometry, Vector3,
} from "three"

import land from "./organization-launch-globe-data.json"
import type { LaunchGlobeLocation } from "../lib/globe-location"

function position(longitude: number, latitude: number, radius = 1) {
  const lat = latitude * Math.PI / 180
  const lng = longitude * Math.PI / 180
  return new Vector3(
    Math.cos(lat) * Math.sin(lng), Math.sin(lat), Math.cos(lat) * Math.cos(lng)
  ).multiplyScalar(radius)
}

export function createLaunchGlobeScene() {
  const globe = new Group()
  globe.rotation.set(39 * Math.PI / 180, 98 * Math.PI / 180, 0)
  globe.position.set(0, 0, 0)
  const ocean = new Mesh(new SphereGeometry(1, 48, 32), new MeshBasicMaterial({ color: "#000000" }))
  globe.add(ocean)

  const dots = new InstancedMesh(
    new SphereGeometry(0.005, 4, 4), new MeshBasicMaterial({ color: "#ffffff" }), land.dots.length
  )
  const matrix = new Matrix4()
  land.dots.forEach(([lng, lat], index) => {
    matrix.makeTranslation(position(lng, lat, 1.002))
    dots.setMatrixAt(index, matrix)
  })
  dots.instanceMatrix.needsUpdate = true
  globe.add(dots)

  // One draw call each for coastlines and the 15-degree geographic grid.
  const coasts: Vector3[] = []
  for (const ring of land.outlines) {
    for (let i = 1; i < ring.length; i++) {
      coasts.push(position(ring[i - 1][0], ring[i - 1][1], 1.001), position(ring[i][0], ring[i][1], 1.001))
    }
  }
  globe.add(new LineSegments(new BufferGeometry().setFromPoints(coasts), new LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6 })))
  const grid: Vector3[] = []
  for (let lat = -75; lat <= 75; lat += 15) {
    for (let lng = -180; lng < 180; lng += 3) grid.push(position(lng, lat, 1.001), position(lng + 3, lat, 1.001))
  }
  for (let lng = -180; lng < 180; lng += 15) {
    for (let lat = -90; lat < 90; lat += 3) grid.push(position(lng, lat, 1.001), position(lng, lat + 3, 1.001))
  }
  globe.add(new LineSegments(new BufferGeometry().setFromPoints(grid), new LineBasicMaterial({ color: "#616161" })))

  const marker = new Mesh(new SphereGeometry(0.018, 16, 12), new MeshBasicMaterial({ color: "#22c55e" }))
  marker.visible = false
  globe.add(marker)

  return {
    globe,
    setLocation(location: LaunchGlobeLocation | null) {
      marker.visible = location !== null
      if (location) {
        marker.position.copy(position(location.longitude, location.latitude, 1.015))
        // Bring this geographic point to the camera-facing center, not the cropped edge.
        globe.position.set(0, 0, 0)
        globe.rotation.set(location.latitude * Math.PI / 180, -location.longitude * Math.PI / 180, 0)
      }
    },
    dispose() {
      globe.traverse((object) => {
        if (object instanceof Mesh || object instanceof LineSegments) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      dots.dispose()
    },
  }
}
