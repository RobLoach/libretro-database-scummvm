const glob = require('glob')
const path = require('path')
const fs = require('fs')
const datfile = require('datfile')
const pkg = require('./package')
const sortObj = require('sort-object')
const ignoreGames = [
	'swampwitch-1'
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
		let description = game.description
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

		if (uniqueRom) {
			uniqueGames[gameName] = games[gameName]
			uniqueGames[gameName].rom = uniqueRom
		}
		else {
			console.log("[WARN] No unique rom: " + gameName);
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

		// Clean up the name to match its description.
		/*
		for (var i in dat) {
			dat[i].name = dat[i].description
		}
		*/

		// Loop through each game in the DAT.
		dat.forEach(function (game) {
			// Ignore some games.
			if (ignoreGames.includes(game.name)) {
				return
			}

			// Ignore all [a] games.
			if (game.name.includes('[a]')) {
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
