const glob = require('glob')
const path = require('path')
const fs = require('fs')
const datfile = require('robloach-datfile')
const pkg = require('./package')
const crc = require('crc')
const sortObj = require('sort-object')
const clone = require('clone')
const ignoreGames = require('./ignore-games.json')
const manualGames = require('./manual-games.json')
const sanitizefilename = require('sanitize-filename')

// Find each ScummVM .DAT file.
//glob("DATs/svm-scu*.dat", function (err, files) {
glob("DATs/svm-*.dat", async function (err, files) {
	if (err) {
		throw err
	}

	let games = await getGamesFromFiles(files);
	let roms = getUniqueRoms(games)
	roms = Object.assign({}, roms, manualGames)
	roms = sortObject(roms)
	writeDAT(roms)
	writeExtensions(roms)
})

function cleanFilename(filename) {
	return sanitizefilename(filename, {
		replacement: '_'
	})
}

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
	//out = out.replace(/ *\([^)]*\) */g, "") // Remove ()
	out = out.replace(/ *\[[^\]]*\] */g, "") // Remove []
    out = out.replace('"', '').replace('"', '') // Remove any extra quotes
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
		let filename = game.rom.name ? `name "${cleanFilename(game.rom.name)}" ` : ''
		let size = game.rom.size ? `size ${game.rom.size} ` : ''
		let crc = game.rom.crc ? `crc ${game.rom.crc.toUpperCase()} ` : ''
		let md5 = game.rom.md5 ? `md5 ${game.rom.md5.toUpperCase()} ` : ''
		let sha1 = game.rom.sha1 ? `sha1 ${game.rom.sha1.toUpperCase()} ` : ''
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

    if (rom.name == 'acsetup.cfg') {
        return false
    }

	// Don't allow pathed files.
	if (rom.name.includes('\\')) {
		return false
	}

	// Check against other existing roms.
	for (let gameName in games) {
		if (gameName != currentGame) {
			let roms = games[gameName].entries

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
		let roms = games[gameName].entries
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
			//' CRLF': '\r\n',
			//' LF': '\n',
			//' CR': '\r'
		}
		for (let newlineType in newlineOptions) {
			let gameCodeWithNewline = gameName + newlineOptions[newlineType]
			let gameTitleWithNewline = gameName + newlineType
			uniqueGames[gameTitleWithNewline] = clone(games[gameName])
			uniqueGames[gameTitleWithNewline].rom = {
				crc: crc.crc32(gameCodeWithNewline).toString(16).toUpperCase(),
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
async function getGamesFromFiles(files) {
	// Construct the initial output of each game.
	var games = {}

	// Load each file.
	for (let file of files) {
		// Load the file.
		console.log('[INFO] Parsing: ' + file)
		var data = fs.readFileSync(file, 'utf8')
		var allGames = await datfile.parse(data)
		// Loop through each game in the DAT.
		for (let game of allGames) {
			// Ignore some games.
			if (ignoreGames.includes(game.name)) {
				continue
			}

			// Ignore all Demos
			if (game.name.includes('-demo')) {
				continue
			}

			// Ignore all [a] games.
			if (game.description.includes('[a]')) {
				continue
			}

			// Do not consider resource files.
			if (game.description && game.description.includes('ZZZ - ')) {
				continue
			}

			// Add the game to the dictionary.
			games[game.name] = game
		}
	}

	return games
}
