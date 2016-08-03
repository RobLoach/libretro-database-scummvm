var glob = require('glob')
var fs = require('fs')
var datfile = require('datfile')
var pkg = require('./package')
var sortObj = require('sort-object')

// Header
var output = `clrmamepro (
	name "${pkg.title}"
	description "${pkg.title}"
	comment "${pkg.comment}"
	category "${pkg.title}"
	version "${pkg.version}"
	author "${pkg.contributors[1].name}"
	homepage "${pkg.homepage}"
)\n`

// Find each ScummVM .DAT file.
glob("DATs/svm-*.dat", function (err, files) {
	if (err) {
		throw err
	}

	// Construct the initial output of each game.
	var out = {}

	// Load each file.
	files.forEach(function (file) {
		// Load the file.
		console.log(file)
		var data = fs.readFileSync(file, 'utf8')
		var dat = datfile.parse(data)

		// Clean up the name to match its description.
		for (var i in dat) {
			dat[i].name = dat[i].description
		}

		// Loop through each game in the DAT.
		dat.forEach(function (game) {
			// Figure out which ROM to use.
			var rom = null
			for (var i in game.roms) {
				var checkRom = game.roms[i]

				// Ensure the rom passes tests.
				if (checkRom.name.indexOf('/') == -1) {
					if (checkRom.name.indexOf('\\') == -1) {
						rom = checkRom
						break;
					}
				}
			}

			// If we didn't find a valid ROM, tell the user.
			if (!rom) {
				rom = game.roms[0]
				console.log('Could not find valid ROM', game)
			}

			// Add the game of the output DAT.
			out[game.name] = `\ngame (
	name "${game.name}"
	description "${game.description}"
	rom ( name "${rom.name}" size ${rom.size} crc ${rom.crc} md5 ${rom.md5} )
)\n`
		})
	})

	// Build the string representing the final DAT.
	for (var name in sortObj(out)) {
		output += out[name]
	}

	// Write the DAT file.
	fs.writeFileSync('ScummVM.dat', output)
})
