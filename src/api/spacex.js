import * as Bundled from '../launchpads.json'

const DEFAULT_LAUNCHES_URL = "http://127.0.0.1:3001/proxy/launches"
const DEFAULT_PADS_URL = "http://127.0.0.1:3001/proxy/pads"

const CACHE_TTL = 60 * 60 * 1000

const memoryCache = new Map()

function cacheKey(url) {
    return "spacex-cache:" + url
}

function readCache(url) {
    const mem = memoryCache.get(url)
    if (mem && mem.expires > Date.now()) return mem.value
    if (typeof localStorage !== "undefined") {
        try {
            const raw = localStorage.getItem(cacheKey(url))
            if (raw) {
                const parsed = JSON.parse(raw)
                if (parsed && parsed.expires > Date.now()) {
                    memoryCache.set(url, parsed)
                    return parsed.value
                }
            }
        } catch (e) {
            // ignore cache read errors
        }
    }
    return null
}

function writeCache(url, value) {
    const entry = { value: value, expires: Date.now() + CACHE_TTL }
    memoryCache.set(url, entry)
    if (typeof localStorage !== "undefined") {
        try {
            localStorage.setItem(cacheKey(url), JSON.stringify(entry))
        } catch (e) {
            // ignore cache write errors (quota, etc.)
        }
    }
}

async function cachedFetch(url) {
    const cached = readCache(url)
    if (cached) {
        console.log('[spacex] cache hit', url)
        return cached
    }
    const response = await fetch(url)
    if (!response.ok) throw new Error("request failed: " + response.status)
    const data = await response.json()
    writeCache(url, data)
    return data
}

function mapPad(pad, launches) {
    return {
        id: String(pad.id),
        name: pad.name,
        full_name: pad.name,
        locality: pad.location && pad.location.name ? pad.location.name : "",
        region: pad.location && pad.location.country && pad.location.country.name ? pad.location.country.name : "",
        latitude: pad.latitude,
        longitude: pad.longitude,
        status: pad.active ? "active" : "retired",
        launches: launches
    }
}

class SpaceX {

    constructor(
        launchesUrl = DEFAULT_LAUNCHES_URL,
        padsUrl = DEFAULT_PADS_URL
    ) {
        this.launchesUrl = launchesUrl
        this.padsUrl = padsUrl
    }

    launches() {
        return cachedFetch(this.launchesUrl)
            .then(data => {
                console.log('[spacex] launches loaded from API')
                return Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : [])
            })
            .catch(() => {
                console.log('[spacex] launches fallback to empty')
                return []
            })
    }

    async launchpads() {
        try {
            const [padsData, launchesData] = await Promise.all([
                cachedFetch(this.padsUrl).catch(() => null),
                cachedFetch(this.launchesUrl).catch(() => null)
            ])
            if (!padsData || !launchesData) {
                console.log('[spacex] fallback to bundled launchpads')
                return Bundled.launchpads
            }
            console.log('[spacex] launchpads loaded from API')
            const pads = padsData ? (Array.isArray(padsData.results) ? padsData.results : (Array.isArray(padsData) ? padsData : [])) : []
            const launches = launchesData ? (Array.isArray(launchesData.results) ? launchesData.results : (Array.isArray(launchesData) ? launchesData : [])) : []

            const launchesByPad = new Map()
            launches.forEach(launch => {
                const padId = launch.pad && launch.pad.id
                if (padId == null) return
                if (!launchesByPad.has(padId)) launchesByPad.set(padId, [])
                launchesByPad.get(padId).push(launch.name)
            })

            return pads.map(pad => mapPad(
                pad,
                (launchesByPad.get(pad.id) || []).slice(0, 5)
            ))
        } catch (e) {
            console.log('[spacex] fallback to bundled launchpads')
            return Bundled.launchpads
        }
    }

    async launchpad(id) {
        try {
            const pads = await this.launchpads()
            const found = pads.find(pad => String(pad.id) === String(id))
            if (found) return found
            const data = await cachedFetch("http://127.0.0.1:3001/proxy/pads/" + id + "/")
            return mapPad(data, [])
        } catch (e) {
            return (Bundled.launchpads || []).find(pad => String(pad.id) === String(id))
        }
    }

}

export { SpaceX }
export { cachedFetch }