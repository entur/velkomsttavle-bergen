import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformTsxToJsx, flattenLabels } from './floorplan-transform.mjs'

const REPO = 'entur/plantegning'
const TSX_PATH = 'src/assets/floorplans/BergenThird.tsx'
const LABELS_PATH = 'src/data/floorplans/bergen-3.json'

const token = process.env.FLOORPLAN_SYNC_TOKEN || process.env.GITHUB_TOKEN
if (!token) {
  console.error('Mangler token: sett FLOORPLAN_SYNC_TOKEN (eller GITHUB_TOKEN).')
  process.exit(1)
}

async function fetchRaw(path) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.raw+json',
        'User-Agent': 'velkomsttavle-bergen-sync',
      },
    }
  )
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${path}`)
  }
  return await res.text()
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'src/floorplan')

const jsx = transformTsxToJsx(await fetchRaw(TSX_PATH))
const labels = flattenLabels(JSON.parse(await fetchRaw(LABELS_PATH)))

await mkdir(outDir, { recursive: true })
await writeFile(resolve(outDir, 'BergenThird.jsx'), jsx)
await writeFile(
  resolve(outDir, 'bergenThirdLabels.json'),
  `${JSON.stringify(labels, null, 2)}\n`
)
console.log('Plantegning synket til src/floorplan/.')
