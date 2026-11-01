import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileHashes, parseScummVMList, gameCodes, parseXmlGames, findXmlMatch, seriesToFranchise, buildDat } from './lib.js'

test('parseScummVMList skips the header', () => {
  const output = [
    'Game ID                        Full Title',
    '------------------------------ ----------------------------',
    'scumm:monkey                   The Secret of Monkey Island',
    '',
  ].join('\n')
  assert.deepEqual(parseScummVMList(output), [{ id: 'scumm:monkey', title: 'The Secret of Monkey Island' }])
})

test('gameCodes qualifies game IDs shared across engines', () => {
  const codes = gameCodes(['scumm:monkey', 'scumm:atlantis', 'cryomni3d:atlantis'])
  assert.equal(codes.get('scumm:monkey'), 'monkey')
  assert.equal(codes.get('scumm:atlantis'), 'scumm:atlantis')
  assert.equal(codes.get('cryomni3d:atlantis'), 'cryomni3d:atlantis')
})

test('findXmlMatch only matches equivalent titles', () => {
  const xml = parseXmlGames([`<LaunchBox>
    <Game><Title>The Secret of Monkey Island</Title></Game>
    <Game><Title>Simon the Sorcerer</Title></Game>
  </LaunchBox>`])
  assert.equal(findXmlMatch('Secret of Monkey Island', xml)?.name, 'The Secret of Monkey Island')
  assert.equal(findXmlMatch('SIMON THE SORCERER', xml)?.name, 'Simon the Sorcerer')
  assert.equal(findXmlMatch('A Clone of Monkey Island', xml), null)
  assert.equal(findXmlMatch('Simon the Sorcerer 2', xml), null)
})

test('seriesToFranchise skips tags and removes suffixes', () => {
  assert.equal(seriesToFranchise('Theme: Humor; Monkey Island series'), 'Monkey Island')
  assert.equal(seriesToFranchise('Discworld Universe'), 'Discworld')
  assert.equal(seriesToFranchise('World Builder games; Theme: Sci-Fi'), '')
})

test('buildDat converts double quotes, lists the extension, and hashes each line ending', () => {
  const dat = buildDat([{ name: 'DeWar\'s "White Label"', code: 'dewarswl', rom: 'dewarswl.scummvm' }], '2026.01.01')
  assert.match(dat, /\textensions "scummvm"\n/)
  assert.match(dat, /\tname "DeWar's 'White Label'"\n/)
  for (const content of ['dewarswl', 'dewarswl\n', 'dewarswl\r\n']) {
    assert.ok(dat.includes(`crc ${fileHashes(content).crc32} `), `Missing hash for ${JSON.stringify(content)}`)
  }
  for (const line of dat.split('\n')) {
    assert.equal(line.split('"').length % 2, 1, `Unbalanced quotes: ${line}`)
  }
})
