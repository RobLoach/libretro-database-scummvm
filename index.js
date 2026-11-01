import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import {
  parseScummVMList,
  gameCodes,
  loadIconsMetadata,
  parseXmlGames,
  findXmlMatch,
  buildDat,
  todayVersion,
} from './lib.js'

const XML_FILES = ['ScummVM.xml', 'ScummVM SVN.xml']
const OUTPUT_DAT = 'libretro-database/dat/ScummVM.dat'
const SCUMMVM_ICONS_DIR = 'scummvm-icons/default'

/**
 * Run scummvm --list-all-games, falling back to flatpak.
 * Returns array of { id, title }.
 */
function getScummVMGames() {
  let output = ''

  // Grab all the supported games.
  try {
    output = execSync('scummvm --list-all-games 2>/dev/null', { encoding: 'utf8' })
  } catch {
    output = execSync('flatpak run org.scummvm.ScummVM --list-all-games 2>/dev/null', { encoding: 'utf8' })
  }
  if (!output.trim()) {
    throw new Error('No output from scummvm --list-all-games. Is ScummVM installed?');
  }

  return parseScummVMList(output)
}

const missingXml = XML_FILES.filter(file => !existsSync(file))
if (missingXml.length) {
  throw new Error(`Missing XML metadata: ${missingXml.join(', ')}`)
}

console.log('Getting ScummVM game list...')
const scummvmGames = getScummVMGames()
console.log(`Found ${scummvmGames.length} ScummVM games`)

console.log('Parsing XML metadata...')
const xmlData = parseXmlGames(XML_FILES.map(file => readFileSync(file, 'utf8')))
console.log(`Loaded ${xmlData.count} XML entries`)

console.log('Reading scummvm-icons metadata...')
const iconsData = loadIconsMetadata(SCUMMVM_ICONS_DIR)
console.log(`Loaded ${iconsData.size} scummvm-icons entries`)

const codes = gameCodes(scummvmGames.map(game => game.id))
const entries = []
let matched = 0
let iconsMatched = 0

for (const { id, title } of scummvmGames) {
  const xml = findXmlMatch(title, xmlData)
  if (xml) matched++
  const icons = iconsData.get(id)
  if (icons) iconsMatched++

  // scummvm-icons is keyed by the exact game ID, so prefer its year and franchise over the title-matched ones.
  // Only keep the month and day when they belong to the same year.
  const releaseyear = icons?.releaseyear || xml?.releaseyear || ''
  const sameYear = releaseyear === xml?.releaseyear

  const code = codes.get(id)
  entries.push({
    name: xml?.name ?? title,
    description: xml?.description ?? '',
    releaseyear,
    releasemonth: sameYear ? xml.releasemonth : '',
    releaseday: sameYear ? xml.releaseday : '',
    developer: xml?.developer || icons?.developer || '',
    franchise: icons?.franchise || xml?.franchise || '',
    genre: xml?.genre ?? '',
    users: xml?.users ?? '',
    publisher: xml?.publisher ?? '',
    esrb_rating: xml?.esrb_rating ?? '',
    code,
    // Colons aren't allowed in Windows file names.
    rom: `${code.replace(':', '-')}.scummvm`,
  })
}

entries.sort((a, b) => a.name.localeCompare(b.name))
console.log(`Matched ${matched}/${scummvmGames.length} games to XML metadata`)
console.log(`Matched ${iconsMatched}/${scummvmGames.length} games to scummvm-icons metadata`)

writeFileSync(OUTPUT_DAT, buildDat(entries, todayVersion()))
console.log(`Wrote ${entries.length} entries to ${OUTPUT_DAT}`)
