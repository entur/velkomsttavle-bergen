import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transformTsxToJsx, flattenLabels } from './floorplan-transform.mjs'

test('transformTsxToJsx removes the type import line', () => {
  const src = [
    "import type { FloorplanSVGProps } from '../../components/FloorplanView'",
    '',
    'const BergenThird = ({ labels }: FloorplanSVGProps) => {',
    '  return null',
    '}',
    '',
    'export default BergenThird',
  ].join('\n')
  const out = transformTsxToJsx(src)
  assert.ok(!out.includes('import type'), 'type import should be gone')
  assert.ok(!out.includes('FloorplanSVGProps'), 'type reference should be gone')
  assert.ok(out.includes('const BergenThird = ({ labels }) => {'))
  assert.ok(out.includes('export default BergenThird'))
})

test('transformTsxToJsx throws when the expected type is missing', () => {
  assert.throws(() => transformTsxToJsx('const x = 1\n'), /FloorplanSVGProps/)
})

test('flattenLabels merges meeting rooms and static labels', () => {
  const config = {
    meetingRooms: [
      { id: 'a', name: 'RoomA', capacity: 6, labelX: 40, labelY: 510 },
      { id: 'skip', name: 'NoLabel', capacity: 2 },
      { id: 'b', name: 'RoomB', labelX: 820, labelY: 700, labelLines: ['Room', 'B'] },
    ],
    staticLabels: [
      { id: 'wc', name: 'WC', x: 45, y: 30 },
      { id: 'skap', name: 'Skap', x: 358, y: 485, rotation: -90 },
    ],
  }
  const result = flattenLabels(config)
  assert.deepEqual(result, [
    { id: 'a', name: 'RoomA', x: 40, y: 510 },
    { id: 'b', name: 'RoomB', x: 820, y: 700, lines: ['Room', 'B'] },
    { id: 'wc', name: 'WC', x: 45, y: 30 },
    { id: 'skap', name: 'Skap', x: 358, y: 485, rotation: -90 },
  ])
})
