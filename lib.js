import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import CRC32 from 'crc-32'
import { XMLParser } from 'fast-xml-parser'

/**
 * Builds out the size, CRC, MD5, and SHA of the given ScummVM ID.
 *
 * @param {string} code The ID of the game.
 * @returns
 */
export function fileHashes(code) {
  const buf = Buffer.from(code, 'utf8')
  return {
    size: buf.length,
    crc32: (CRC32.buf(buf) >>> 0).toString(16).padStart(8, '0'),
    md5: createHash('md5').update(buf).digest('hex'),
    sha1: createHash('sha1').update(buf).digest('hex'),
  }
}

/**
 * Parse the output of scummvm --list-all-games.
 * Returns array of { id, title }.
 */
export function parseScummVMList(output) {
  const lines = output.split('\n')
  const games = []
  let pastHeader = false

  for (const line of lines) {
    if (/^-{3,}/.test(line)) {
      pastHeader = true
      continue
    }
    if (!pastHeader || !line.trim()) continue

    // Game IDs never contain spaces, so split on the first run of whitespace rather than a fixed column width.
    const match = line.trim().match(/^(\S+)\s+(.+)$/)
    if (match) {
      games.push({ id: match[1], title: match[2].trim() })
    }
  }

  return games
}

/**
 * Map each "engine:gameid" to the code written in the .scummvm file.
 *
 * The bare game ID is used when it's unique. When several engines share a game ID, the bare ID is
 * ambiguous and the core refuses to launch it, so the qualified "engine:gameid" is used instead.
 *
 * @param {string[]} ids The qualified "engine:gameid" IDs.
 * @returns {Map<string, string>}
 */
export function gameCodes(ids) {
  const bare = id => id.replace(/^[^:]+:/, '')
  const counts = new Map()
  for (const id of ids) {
    counts.set(bare(id), (counts.get(bare(id)) ?? 0) + 1)
  }
  return new Map(ids.map(id => [id, counts.get(bare(id)) > 1 ? id : bare(id)]))
}

/**
 * Parse an XML file from scummvm-icons, returning the list of child elements.
 *
 * @param {string} path The path to the XML file.
 * @param {string} root The root element name, e.g. "games".
 * @param {string} child The child element name, e.g. "game".
 * @returns {object[]}
 */
function readIconsXml(path, root, child) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: false,
    isArray: (name) => name === child,
  })
  return parser.parse(readFileSync(path, 'utf8'))?.[root]?.[child] ?? []
}

/**
 * Load game metadata from scummvm-icons (year, company, series).
 *
 * https://github.com/scummvm/scummvm-icons
 *
 * @param {string} dir The path to the scummvm-icons "default" directory.
 * @returns {Map<string, object>} Map of "engine:gameid" -> { releaseyear, developer, franchise }.
 */
export function loadIconsMetadata(dir) {
  const games = readIconsXml(`${dir}/games.xml`, 'games', 'game')
  const companies = readIconsXml(`${dir}/companies.xml`, 'companies', 'company')
  const series = readIconsXml(`${dir}/series.xml`, 'series', 'serie')
  const companyNames = new Map(companies.map(c => [c.id, c.name]))
  const seriesNames = new Map(series.map(s => [s.id, s.name]))

  const metadata = new Map()
  for (const game of games) {
    if (!game.id || !game.engine_id) continue
    metadata.set(`${game.engine_id}:${game.id}`, {
      releaseyear: /^\d{4}$/.test(game.year ?? '') ? game.year : '',
      developer: companyNames.get(game.company_id) ?? '',
      franchise: seriesNames.get(game.series_id) ?? '',
    })
  }
  return metadata
}

/**
 * Normalize a title for matching.
 */
export function normalize(title) {
  return title
    .toLowerCase()
    .replace(/^(the |a |an )/, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Turn a LaunchBox series, a list of MobyGames groups, into a franchise name.
 *
 * Groups like "Theme: Horror" or "World Builder games" aren't franchises, so they're skipped, and
 * suffixes like " series" are removed, e.g. "Theme: Humor; Monkey Island series" -> "Monkey Island".
 */
export function seriesToFranchise(series) {
  for (const group of String(series).split(';').map(g => g.trim())) {
    if (!group || /^\w+:/.test(group) || /(games|variants|versions|translations)$/i.test(group)) continue
    return group.replace(/ (series|universe|licensees)$/i, '')
  }
  return ''
}

/**
 * Parse LaunchBox XML documents, returning lookup tables of title -> metadata.
 *
 * @param {string[]} xmls The contents of the XML files.
 */
export function parseXmlGames(xmls) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) => name === 'Game',
  })

  const byTitle = new Map()
  const byTitleLower = new Map()
  const byTitleNorm = new Map()
  let count = 0

  for (const xml of xmls) {
    const parsed = parser.parse(xml)
    const games = parsed?.LaunchBox?.Game ?? []

    for (const game of games) {
      const title = game.Title != null ? String(game.Title) : ''
      if (!title) continue

      const entry = {
        name: title,
        // Limit the description to one paragraph of ASCII.
        description: game.Notes
          ? toAscii(String(game.Notes).split(/\r?\n\r?\n/)[0].replace(/\r?\n/g, ' ')).trim()
          : '',
        releaseyear: game.ReleaseYear ? String(game.ReleaseYear)
          : game.ReleaseDate ? String(parseInt(String(game.ReleaseDate).split('-')[0], 10) || '') : '',
        releasemonth: game.ReleaseDate ? String(parseInt(String(game.ReleaseDate).split('-')[1], 10) || '') : '',
        releaseday: game.ReleaseDate ? String(parseInt(String(game.ReleaseDate).split('-')[2], 10) || '') : '',
        developer: game.Developer ? String(game.Developer) : '',
        genre: game.Genre ? consolidateGenre(String(game.Genre)) : '',
        users: game.MaxPlayers ? String(game.MaxPlayers) : '',
        publisher: game.Publisher ? String(game.Publisher) : '',
        franchise: game.Series ? seriesToFranchise(game.Series) : '',
        esrb_rating: game.Rating ? mapEsrb(String(game.Rating)) : '',
      }

      count++
      if (!byTitle.has(title)) byTitle.set(title, entry)
      const lower = title.toLowerCase()
      if (!byTitleLower.has(lower)) byTitleLower.set(lower, entry)
      const norm = normalize(title)
      if (!byTitleNorm.has(norm)) byTitleNorm.set(norm, entry)
    }
  }

  return { byTitle, byTitleLower, byTitleNorm, count }
}

/**
 * Find the XML metadata for a ScummVM game title.
 *
 * Fuzzy matching is deliberately avoided, since similar titles are usually different games.
 */
export function findXmlMatch(title, { byTitle, byTitleLower, byTitleNorm }) {
  // 1. Exact match
  if (byTitle.has(title)) return byTitle.get(title)

  // 2. Case-insensitive match
  const lower = title.toLowerCase()
  if (byTitleLower.has(lower)) return byTitleLower.get(lower)

  // 3. Normalized match, skipping titles that normalize to nothing, like Japanese ones.
  const norm = normalize(title)
  if (norm && byTitleNorm.has(norm)) return byTitleNorm.get(norm)

  return null
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

export function toAscii(str) {
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

export function consolidateGenre(raw) {
  const tags = new Set()
  for (const group of raw.split(';')) {
    for (const segment of group.split('/')) {
      const tag = GENRE_MAP[segment.trim()]
      if (tag) tags.add(tag)
    }
  }
  return [...tags].join(' / ')
}

/**
 * Format today's date as YYYY.MM.DD.
 */
export function todayVersion() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

/**
 * Build the clrmamepro DAT file.
 */
export function buildDat(entries, version) {
  let dat = `clrmamepro (\n`
  dat += `\tname "ScummVM"\n`
  dat += `\tdescription "ScummVM"\n`
  dat += `\tcomment "DAT file containing .scummvm files to launch ScummVM games from RetroArch."\n`
  dat += `\tcategory "ScummVM"\n`
  dat += `\tversion "${version}"\n`
  dat += `\tauthor "libretro"\n`
  dat += `\thomepage "https://github.com/RobLoach/libretro-database-scummvm"\n`
  dat += `\textensions "scummvm"\n`
  dat += `)\n`

  // libretro-database's DAT parser has no escape sequences, and any double quote ends the value.
  const field = (key, value) => value ? `\t${key} "${String(value).replaceAll('"', "'")}"\n` : ''

  for (const entry of entries) {
    const meta = [
      field('name', entry.name),
      field('description', entry.description),
      field('releaseyear', entry.releaseyear),
      field('releasemonth', entry.releasemonth),
      field('releaseday', entry.releaseday),
      field('developer', entry.developer),
      field('publisher', entry.publisher),
      field('franchise', entry.franchise),
      field('genre', entry.genre),
      field('users', entry.users),
      field('esrb_rating', entry.esrb_rating),
      field('code', entry.code),
    ].join('')

    // The core trims whitespace, so match files with Unix, Windows, or no line endings.
    for (const content of [entry.code + '\n', entry.code + '\r\n', entry.code]) {
      const h = fileHashes(content)
      dat += `\ngame (\n`
      dat += meta
      dat += `\trom ( name "${entry.rom}" size ${h.size} crc ${h.crc32} md5 ${h.md5} sha1 ${h.sha1} )\n`
      dat += `)\n`
    }
  }

  return dat
}
