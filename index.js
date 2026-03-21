import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createHash } from 'crypto'
import CRC32 from 'crc-32'
import { XMLParser } from 'fast-xml-parser'

/**
 * Builds out the size, CRC, MD5, and SHA of the given ScummVM ID.
 *
 * @param {string} code The ID of the game.
 * @returns
 */
function fileHashes(code) {
  const buf = Buffer.from(code, 'utf8')
  return {
    size: buf.length,
    crc32: (CRC32.buf(buf) >>> 0).toString(16).padStart(8, '0'),
    md5: createHash('md5').update(buf).digest('hex'),
    sha1: createHash('sha1').update(buf).digest('hex'),
  }
}

const XML_FILES = ['ScummVM.xml', 'ScummVM SVN.xml']
const OUTPUT_DAT = 'libretro-database/dat/ScummVM.dat'
const OUTPUT_EXT = 'extensions.txt'

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

  const lines = output.split('\n')
  const games = []
  let pastHeader = false

  for (const line of lines) {
    if (/^-{3,}/.test(line)) {
      pastHeader = true
      continue
    }
    if (!pastHeader || !line.trim()) continue

    const id = line.slice(0, 24).trim()
    const title = line.slice(25).trim()
    if (id && title) {
      games.push({ id, title })
    }
  }

  return games
}7

/**
 * Normalize a title for fuzzy matching.
 */
function normalize(title) {
  return title
    .toLowerCase()
    .replace(/^(the |a |an )/, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'in', 'to', 'and', 'or', 'for', 'is', 'it', 'on', 'at', 'by', 'my', 'his', 'her', 'its'])

/**
 * Jaccard similarity between two normalized title strings, ignoring stop words.
 *
 * https://en.wikipedia.org/wiki/Jaccard_index
 */
function jaccardSimilarity(a, b) {
  const wordsA = new Set(a.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w)))
  const wordsB = new Set(b.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w)))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let intersection = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++
  }
  const union = new Set([...wordsA, ...wordsB]).size
  return intersection / union
}

/**
 * Parse ScummVM.xml and ScummVM SVN.xml, returning a map of title -> metadata.
 */
function parseXmlGames(xmlFiles) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) => name === 'Game',
  })

  const byTitle = new Map()
  const byTitleLower = new Map()
  const byTitleNorm = new Map()
  const allEntries = []

  for (const xmlFile of xmlFiles) {
    if (!existsSync(xmlFile)) continue
    const xml = readFileSync(xmlFile, 'utf8')
    const parsed = parser.parse(xml)
    const games = parsed?.LaunchBox?.Game ?? []

    for (const game of games) {
      const title = game.Title != null ? String(game.Title) : ''
      if (!title) continue

      const entry = {
        name: title,
        // Limit the description to one paragraph of ASCII.
        description: game.Notes
          ? toAscii(String(game.Notes).split(/\r?\n\r?\n/)[0].replace(/\r?\n/g, ' ')).replace(/"/g, "'").trim()
          : '',
        releaseyear: game.ReleaseYear ? String(game.ReleaseYear)
          : game.ReleaseDate ? String(parseInt(String(game.ReleaseDate).split('-')[0], 10) || '') : '',
        releasemonth: game.ReleaseDate ? String(parseInt(String(game.ReleaseDate).split('-')[1], 10) || '') : '',
        releaseday: game.ReleaseDate ? String(parseInt(String(game.ReleaseDate).split('-')[2], 10) || '') : '',
        developer: game.Developer ? String(game.Developer) : '',
        genre: game.Genre ? consolidateGenre(String(game.Genre)) : '',
        users: game.MaxPlayers ? String(game.MaxPlayers) : '',
        publisher: game.Publisher ? String(game.Publisher) : '',
        esrb_rating: game.Rating ? mapEsrb(String(game.Rating)) : '',
      }

      allEntries.push({ title, norm: normalize(title), entry })

      if (!byTitle.has(title)) byTitle.set(title, entry)
      const lower = title.toLowerCase()
      if (!byTitleLower.has(lower)) byTitleLower.set(lower, entry)
      const norm = normalize(title)
      if (!byTitleNorm.has(norm)) byTitleNorm.set(norm, entry)
    }
  }

  return { byTitle, byTitleLower, byTitleNorm, allEntries }
}

/**
 * Find the best XML metadata match for a ScummVM game title.
 */
function findXmlMatch(title, { byTitle, byTitleLower, byTitleNorm, allEntries }) {
  // 1. Exact match
  if (byTitle.has(title)) return byTitle.get(title)

  // 2. Case-insensitive match
  const lower = title.toLowerCase()
  if (byTitleLower.has(lower)) return byTitleLower.get(lower)

  // 3. Normalized match
  const norm = normalize(title)
  if (byTitleNorm.has(norm)) return byTitleNorm.get(norm)

  // 4. Best Jaccard similarity match (threshold 0.5 to avoid false positives)
  let bestEntry = null
  let bestScore = 0
  for (const { norm: xmlNorm, entry } of allEntries) {
    const score = jaccardSimilarity(norm, xmlNorm)
    if (score > bestScore) {
      bestScore = score
      bestEntry = entry
    }
  }

  return bestScore >= 0.5 ? bestEntry : null
}

/**
 * Format today's date as YYYY.MM.DD.
 */
function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Maps raw genre segments to consolidated tags.
// Segments that don't appear here are dropped (too specific).
const GENRE_MAP = {
  'Action': 'Action',
  'Adventure': 'Adventure',
  'Application': 'Application',
  'Board Game': 'Board Game',
  'Cards & Tiles': 'Cards & Tiles',
  'Creativity': 'Creativity',
  'Demo': 'Demo',
  'Education': 'Education',
  'Hidden Object': 'Hidden Object',
  'Puzzle': 'Puzzle',
  'Quiz': 'Quiz',
  'Racing & Driving': 'Racing & Driving',
  'Role-Playing': 'Role-Playing',
  'Shooter': 'Shooter',
  'Simulation': 'Simulation',
  'Sports': 'Sports',
  'Strategy': 'Strategy',
  // Sub-genres kept as top-level tags
  'Arcade': 'Arcade',
  'First Person': 'First Person',
  'Interactive Book': 'Interactive Book',
  'Interactive Fiction': 'Interactive Fiction',
  'Interactive Movie': 'Interactive Movie',
  'Platform': 'Platform',
  'Point & Click': 'Point & Click',
  'RTS': 'RTS',
  'Screensaver': 'Screensaver',
  'Turn-based': 'Turn-based',
}

const ESRB_MAP = {
  'EC': 'EC',
  'E': 'E',
  'E10+': 'E',
  'T': 'T',
  'M': 'M',
  'A': 'M',
  'RP': 'RP',
}

function toAscii(str) {
  return str
    // Common Unicode replacements before NFD normalization
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")   // smart single quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')   // smart double quotes
    .replace(/\u2014/g, '--')       // em dash
    .replace(/\u2013/g, '-')        // en dash
    .replace(/\u2026/g, '...')      // ellipsis
    .replace(/\u00B7|\u2022|\u2023|\u2043/g, '*')  // bullets
    .replace(/\u00A0/g, ' ')        // non-breaking space
    .replace(/\u00A9/g, '(c)')      // copyright
    .replace(/\u00AE/g, '(r)')      // registered
    .replace(/\u2122/g, '(TM)')     // trademark
    .replace(/\u00D7/g, 'x')        // multiplication sign
    .replace(/\u00F7/g, '/')        // division sign
    .replace(/\u00BD/g, '1/2')      // half
    .replace(/\u00BC/g, '1/4')      // quarter
    .replace(/\u00BE/g, '3/4')      // three-quarters
    .replace(/\u00C6/g, 'AE').replace(/\u00E6/g, 'ae')
    .replace(/\u0152/g, 'OE').replace(/\u0153/g, 'oe')
    .replace(/\u00DF/g, 'ss')       // sharp s
    .replace(/\u00D0/g, 'D').replace(/\u00F0/g, 'd')   // eth
    .replace(/\u00DE/g, 'Th').replace(/\u00FE/g, 'th') // thorn
    .replace(/\u00AB|\u00BB/g, '"') // guillemets
    .replace(/\u2039|\u203A/g, "'") // single guillemets
    // NFD decomposition strips combining diacritics (e.g. é → e)
    .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
    // Drop any remaining non-ASCII
    .replace(/[^\x00-\x7F]/g, '')
}

function mapEsrb(raw) {
  const key = raw.split(' ')[0]
  return ESRB_MAP[key] ?? ''
}

function consolidateGenre(raw) {
  const tags = new Set()
  for (const group of raw.split(';')) {
    for (const segment of group.split('/')) {
      const tag = GENRE_MAP[segment.trim()]
      if (tag) tags.add(tag)
    }
  }
  return [...tags].join(' / ')
}

function todayVersion() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

/**
 * Build and write the clrmamepro DAT file.
 */
function writeDat(entries, outputPath) {
  const version = todayVersion()
  let dat = `clrmamepro (\n`
  dat += `\tname "ScummVM"\n`
  dat += `\tdescription "ScummVM"\n`
  dat += `\tcomment "DAT file containing .scummvm files to launch ScummVM games from RetroArch."\n`
  dat += `\tcategory "ScummVM"\n`
  dat += `\tversion "${version}"\n`
  dat += `\tauthor "libretro"\n`
  dat += `\thomepage "http://github.com/RobLoach/libretro-database-scummvm"\n`
  dat += `)\n`

  for (const entry of entries) {
    const meta = [
      `\tname "${entry.name}"\n`,
      entry.description ? `\tdescription "${entry.description}"\n` : '',
      entry.releaseyear ? `\treleaseyear "${entry.releaseyear}"\n` : '',
      entry.releasemonth ? `\treleasemonth "${entry.releasemonth}"\n` : '',
      entry.releaseday ? `\treleaseday "${entry.releaseday}"\n` : '',
      entry.developer ? `\tdeveloper "${entry.developer}"\n` : '',
      entry.genre ? `\tgenre "${entry.genre}"\n` : '',
      entry.users ? `\tusers "${entry.users}"\n` : '',
      entry.publisher ? `\tpublisher "${entry.publisher}"\n` : '',
      entry.esrb_rating ? `\tesrb_rating "${entry.esrb_rating}"\n` : '',
      `\tcode "${entry.code}"\n`,
    ].join('')

    for (const content of [entry.code + '\n', entry.code]) {
      const h = fileHashes(content)
      dat += `\ngame (\n`
      dat += meta
      dat += `\trom ( name "${entry.rom}" size ${h.size} crc32 ${h.crc32} md5 ${h.md5} sha1 ${h.sha1} )\n`
      dat += `)\n`
    }
  }

  writeFileSync(outputPath, dat)
  console.log(`Wrote ${entries.length} entries to ${outputPath}`)
}

console.log('Getting ScummVM game list...')
const scummvmGames = getScummVMGames()
console.log(`Found ${scummvmGames.length} ScummVM games`)

console.log('Parsing XML metadata...')
const xmlData = parseXmlGames(XML_FILES)
console.log(`Loaded ${xmlData.allEntries.length} XML entries`)

const entries = []
let matched = 0

for (const { id, title } of scummvmGames) {
  const xml = findXmlMatch(title, xmlData)
  if (xml) matched++

  const code = id.replace(/^[^:]+:/, '') || slugify(title)
  entries.push({
    name: xml?.name ?? title,
    description: xml?.description ?? '',
    releaseyear: xml?.releaseyear ?? '',
    releasemonth: xml?.releasemonth ?? '',
    releaseday: xml?.releaseday ?? '',
    developer: xml?.developer ?? '',
    genre: xml?.genre ?? '',
    users: xml?.users ?? '',
    publisher: xml?.publisher ?? '',
    esrb_rating: xml?.esrb_rating ?? '',
    code,
    rom: `${code}.scummvm`,
  })
}

entries.sort((a, b) => a.name.localeCompare(b.name))
console.log(`Matched ${matched}/${scummvmGames.length} games to XML metadata`)

writeDat(entries, OUTPUT_DAT)
writeFileSync(OUTPUT_EXT, 'scummvm\n')
console.log(`Wrote ${OUTPUT_EXT}`)
