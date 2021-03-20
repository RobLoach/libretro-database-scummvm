const glob = require('glob')
const path = require('path')
const fs = require('fs')
const datfile = require('datfile')
const pkg = require('./package')
const crc = require('crc')
const sortObj = require('sort-object')
const clone = require('clone')
const ignoreGames = [
	'swampwitch-1',
	'tentacle-cd-mep',
	'worldofxeen-de-1',
	'gob2-amiga-fr',
	'gob3cd-1',
	'kyra2-cd-pc98',
	'guiltybastards-1',
	'cruise-de-1',
	'cruise-fr-1',
	'simon1-1',
	'findtheheart-1',
	'findtheheart-2',
	'fredrogersterrorist-1',
	'karthofthejungle-1',
	'monkey-ega-it-1',
	'nippon-1',
	'nippon-amiga-it',
	'nippon-amiga',
	'lol-cd-1',
	'lol-cd-fr-1',
	'lol-cd-fr',
	'lol-cd-de',
	'fw-1',
	'simon1-cd-es',
	'simon1-cd-fr',
	'simon1-cd-il',
	'simon1-cd-it',
	'simon1-cd-ru',
	'simon1-cz',
	'simon1-demo-1',
	'simon1-demo-acorn',
	'simon1-mep',
	'simon1-mep-es',
	'simon1-mep-fr',
	'simon1-mep-il',
	'simon1-mep-it',
	'simon1-mep-ru',
	'simon1-ru',
	'simon1-win-it',
	'simon1-win-mep',
	'simon1-win-mep-it',
	'lab-1',
	'dig-1',
	'sword1-1',
	'sword1-2',
	'sword1-3',
	'sword1-ru-1',
	'sword1-es-1',
	'simon1-amiga-1',
	'simon1-cz-1',
	'gob3-gb-2',
	'11h-mac',
	'bra-1',
	'kq6-kr',
	'kq7-es',
	'kq7-it',
	'kq7-mac',
	'lighthouse-fr-1',
	'mothergoose256-fm-jp',
	'torin-he',
	'torin-cd-win-br',
	'torin-cd-win-de-1',
	'torin-cd-win-es',
	'torin-cd-win-fr-1',
	'torin-cd-win-fr-2',
	'torin-cd-win-de-2',
	'torin-cd-win-br',
	'comi-br',
	'comi-br-1',
	'comi-cz',
	'comi-de',
	'comi-demo',
	'comi-demo-1',
	'comi-es',
	'comi-fr',
	'comi-hu',
	'comi-it',
	'comi-pl',
	'comi-ru',
	'comi-ru-1',
	'comi-ru-2',
	'comi-ru-3',
	'comi-ru-4',
	'comi-ru-5',
	'tentacle-demo-mac',
	'tentacle-cd-mac-de',
	'tentacle-cd-mac-fr',
	'tentacle-cd-mac',
	'dig-de',
	'dig-demo-mac',
	'dig-es',
	'dig-fr',
	'dig-it',
	'lab-win',
	'dig-kr-1',
	'dig-mac',
	'dig-mac-fr',
	'dig-steam-win',
	'ft-mac-de',
	'ft-mac-fr',
	'loom-ega-5',
	'loom-ega-es',
	'loom-ega-st-es',
	'loom-steam-mac',
	'worldofxeen-de',
	'thephoenixv12',
	'pegasus-demo-mac',
	'ite-cd-mac-2',
	'gk1-cd-kr',
	'kq6-cd-win',
	'kq7-win-2',
	'activity-mac',
	'farm-demo-mac',
	'fbear-demo-mac',
	'zak-v2-it-1',
	'frasse-1'
]

// Find each ScummVM .DAT file.
//glob("DATs/svm-scu*.dat", function (err, files) {
glob("DATs/svm-*.dat", function (err, files) {
	if (err) {
		throw err
	}

	let games = getGamesFromFiles(files);
	let roms = getUniqueRoms(games)
	roms = sortObject(roms)
	writeDAT(roms)
	writeExtensions(roms)
})

/**
 * Sort the given object by name.
 */
function sortObject(objectToSort) {
	let keys = Object.keys(objectToSort).sort();
	let sortedObject = {}
	for (let keyIndex in keys) {
		let keyName = keys[keyIndex]
		sortedObject[keyName] = objectToSort[keyName]
	}
	return sortedObject
}

/**
 * Create a extensions.txt based on the given games
 */
function writeExtensions(games) {
	let extensions = {
		'scummvm': true,
		'scumm': true
	}
	for (let gameName in games) {
		let game = games[gameName].rom
		let ext = path.extname('testfile' + game.name).replace('.', '')
		if (ext) {
			extensions[ext] = true
		}
	}
	fs.writeFileSync('extensions.txt', Object.keys(extensions).join('|'))
}

function cleanName(name) {
	let out = name.replace('[!]', '')
	out = out.replace('|Demo|', '')
	out = out.replace(/ *\([^)]*\) */g, "")
	out = out.replace(/ *\[[^\]]*\] */g, "")
	return out.trim()
}

/**
 * Given the games, write a DAT.
 */
function writeDAT(games) {
	// Header
	let output = `clrmamepro (
	name "${pkg.title}"
	description "${pkg.title}"
	comment "${pkg.comment}"
	category "${pkg.title}"
	version "${pkg.version}"
	author "${pkg.contributors[0].name}"
	homepage "${pkg.homepage}"
)\n`

	for (let gameName in games) {
		let game = games[gameName]
		let description = cleanName(game.description)
		let releaseyear = game.year ? `\n	releaseyear "${game.year}"`: ''
		let developer = game.manufacturer ? `\n	developer "${game.manufacturer}"`: ''
		let filename = game.rom.name ? `name "${game.rom.name}" ` : ''
		let size = game.rom.size ? `size ${game.rom.size} ` : ''
		let crc = game.rom.crc ? `crc ${game.rom.crc} ` : ''
		let md5 = game.rom.md5 ? `md5 ${game.rom.md5} ` : ''
		let sha1 = game.rom.sha1 ? `sha1 ${game.rom.sha1} ` : ''
		output += `\ngame (
	name "${description}"
	description "${description}"${releaseyear}${developer}
	code "${gameName}"
	rom ( ${filename}${size}${crc}${md5}${sha1})
)\n`
	}

	fs.writeFileSync('libretro-database/dat/ScummVM.dat', output)
}

/**
 * Check whether or not the given rom is unique.
 */
function isRomUnique(games, currentGame, rom) {
	// Require a CRC.
	if (!rom.crc) {
		return false
	}

	// Require a file extension.
	if (!path.extname(rom.name).replace('.', '')) {
		return false
	}

	// Don't allow pathed files.
	if (rom.name.includes('\\')) {
		return false
	}

	// Check against other existing roms.
	for (let gameName in games) {
		if (gameName != currentGame) {
			let roms = games[gameName].roms

			for (let romIndex in roms) {
				let checkRom = roms[romIndex]
				if (checkRom.crc == rom.crc) {
					return false;
				}
			}
		}
	}

	return true;
}

/**
 * Retrieve a new array of unique roms.
 */
function getUniqueRoms(games) {
	let uniqueGames = {}

	for (let gameName in games) {
		let roms = games[gameName].roms
		let uniqueRom = false

		for (let romIndex in roms) {
			let rom = roms[romIndex]
			if (isRomUnique(games, gameName, rom)) {
				uniqueRom = rom
				break;
			}
		}

		// If there is a unique rom, use it.
		if (uniqueRom) {
			uniqueGames[gameName] = games[gameName]
			uniqueGames[gameName].rom = uniqueRom
		}
		else {
			// Since there isn't a unique rom, use a .scummvm file instead.
			console.log("[WARN] No unique rom: " + gameName + '. Use .scummvm file instead.');
		}

		// Allow for newlines at the end of the .scummvm file.
		let newlineOptions = {
			' ScummVM File': '',
			' CRLF': '\r\n',
			' LF': '\n',
			' CR': '\r'
		}
		for (let newlineType in newlineOptions) {
			let gameCodeWithNewline = gameName + newlineOptions[newlineType]
			let gameTitleWithNewline = gameName + newlineType
			uniqueGames[gameTitleWithNewline] = clone(games[gameName])
			uniqueGames[gameTitleWithNewline].rom = {
				crc: crc.crc32(gameCodeWithNewline).toString(16),
				size: gameCodeWithNewline.length,
				name: games[gameName].description + newlineType + '.scummvm',
			}
		}
	}

	return uniqueGames
}

/**
 * Retrieve an array of games from the given DAT files.
 */
function getGamesFromFiles(files) {
	// Construct the initial output of each game.
	var games = {}

	// Load each file.
	files.forEach(function (file) {
		// Load the file.
		console.log('[INFO] Parsing: ' + file)
		var data = fs.readFileSync(file, 'utf8')
		var dat = datfile.parse(data)

		// Loop through each game in the DAT.
		dat.forEach(function (game) {
			// Ignore some games.
			if (ignoreGames.includes(game.name)) {
				return
			}

			// Ignore all [a] games.
			if (game.description.includes('[a]')) {
				return
			}

			// Do not consider resource files.
			if (game.description && game.description.includes('ZZZ - ')) {
				return
			}

			// Add the game to the dictionary.
			games[game.name] = game
		})
	})

	return games
}
