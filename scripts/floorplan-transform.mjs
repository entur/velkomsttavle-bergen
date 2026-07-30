export function transformTsxToJsx(source) {
  if (!source.includes('FloorplanSVGProps')) {
    throw new Error(
      'Uventet BergenThird-struktur: fant ikke FloorplanSVGProps. ' +
        'Sjekk om kildefila i entur/plantegning har endret signatur.'
    )
  }
  return source
    // fjern type-import-linja (med eller uten semikolon)
    .replace(/^import type \{[^}]*\} from ['"][^'"]*FloorplanView['"];?\r?\n/m, '')
    // fjern type-annotasjonen på props
    .replace(/:\s*FloorplanSVGProps/, '')
    // Kildekatalogen er src/assets/floorplans/ (dybde 3), men utfilen plasseres i
    // src/floorplan/ (dybde 2), så den relative stien til utils må justeres.
    .replace(
      /from (['"])\.\.\/\.\.\/utils\/labelOrigin\1/g,
      "from '../utils/labelOrigin'"
    )
}

export function flattenLabels(config) {
  const roomLabels = config.meetingRooms
    .filter((r) => r.labelX !== undefined && r.labelY !== undefined)
    .map((r) => ({
      id: r.id,
      name: r.name,
      x: r.labelX,
      y: r.labelY,
      ...(r.labelLines ? { lines: r.labelLines } : {}),
    }))
  const staticLabels = config.staticLabels.map((l) => ({
    id: l.id,
    name: l.name,
    x: l.x,
    y: l.y,
    ...(l.lines ? { lines: l.lines } : {}),
    ...(l.rotation !== undefined ? { rotation: l.rotation } : {}),
  }))
  return [...roomLabels, ...staticLabels]
}
