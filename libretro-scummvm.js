const assert = require('assert')
const fs = require('fs')
const exec = require('child_process').execSync
const crc = require('crc')
const rimraf = require('rimraf')
const pkg = require('./package.json')

// Clean the games directory.
rimraf.sync('games')
fs.mkdirSync('games')

var output = `clrmamepro (
	name "${pkg.title}"
	description "${pkg.title}"
	comment "${pkg.description}"
	version ${pkg.version}
	date "${pkg.date}"
	author "${pkg.author}"
	homepage ${pkg.authorUrl}
	url ${pkg.homepage}
)
`

// Build the .scummvm files.
exec('scummvm --list-games')
	// Port the Buffer to a string.
	.toString()
	// Split it into an array.
	.split('\n')
	// Remove the first two elements (header and line devision)
	.splice(2)
	// Alphabetically sort the list
	.sort()
	// Loop through each one an make the .scummvm file
	.forEach(function (line) {
		var name = line.substring(0, 20).trim()
		var title = line.substring(20).replace('/', ' - ').replace('?', '').replace(new RegExp(':', 'g'), '').trim()
		if (name.length > 0) {
			// Begin the .DAT header
			output += `
game (
	name "${title}"
	description "${title}"
`

			// New lines can appear at the end of the .scummvm files, allow for this to happen.
			var newlineOptions = {
				'': '',
				' Windows': '\r\n',
				' Unix': '\n'
			}
			for (var newlineType in newlineOptions) {
				// Construct the contents of the .scummvm file
				var contents = name + newlineOptions[newlineType]

				// Write the file
				fs.writeFileSync(`games/${title}${newlineType}.scummvm`, contents, {
					encoding: 'ascii'
				})

				// Calculate the CRC for the entry
				var crcValue = crc.crc32(contents).toString(16)

				// Diplay an output
				console.log(title, newlineType, '-', name, '-', crcValue)

				// Write the rom entry to the .DAT file.
				output += `	rom ( name "${title}${newlineType}.scummvm" size ${contents.length} crc ${crcValue} )\n`
			}
			output += ')\n'
		}
	})

// Write the DAT file.
fs.writeFileSync('ScummVM.dat', output, {
	// Make sure to use the ASCII encoding.
	'encoding': 'ascii'
})
