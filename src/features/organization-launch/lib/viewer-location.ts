import { resolveLaunchGlobeLocation, type LaunchGlobeLocation } from "./globe-location"

export function requestLaunchViewerLocation(
  geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined
): Promise<LaunchGlobeLocation> {
  if (!geolocation) return Promise.reject(new Error("Location isn’t available in this browser."))
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = resolveLaunchGlobeLocation(coords)
        if (location) resolve(location)
        else reject(new Error("Your location couldn’t be found. Try again."))
      },
      ({ code }) => reject(new Error(code === 1
        ? "Location access is blocked. Allow it in your browser’s site settings."
        : code === 3 ? "Location took too long. Try again."
          : "Your location couldn’t be found. Try again.")),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 }
    )
  })
}
