const assert = require('assert')
const fs = require('fs')
const crc = require('crc')
const rimraf = require('rimraf')
const sortObject = require('sort-object')
const pkg = require('./package.json')
const exec = require('child_process').execSync

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

// Default set of unlisted games.
var games = require('./games')

// Build the .scummvm files.
exec('/tmp/scummvm/scummvm --list-games')
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
		var id = line.substring(0, 20).trim()
		if (id.length > 0) {
			var title = line.substring(20)
				.replace('/', ' - ')
				.replace(': ', ' - ')
				.replace('?', '')
				.replace('#', '')
				.replace('!', '')
				.replace('&', 'and')
				.replace(new RegExp(':', 'g'), '')
				.trim()
			games[id] = title
		}
	})

// Sort the games by title
games = sortObject(games, {
	sort: function (a, b) {
		return (games[a] < games[b]) ? -1 : 1;
	}
})

// Output each game to the DAT file.
for (var id in games) {
	var name = games[id]

	// New lines can appear at the end of the .scummvm files, allow for this to happen.
	var newlineOptions = {
		'': '',
		' CRLF': '\r\n',
		' LF': '\n',
		' CR': '\r'
	}
	for (var newlineType in newlineOptions) {
		// Construct the contents of the .scummvm file
		var contents = id + newlineOptions[newlineType]
		var filename = `${name}${newlineType}`
				.replace('/', ' - ')
				.replace(': ', ' - ')
				.replace(',', '')
				.replace('\'', '')
				.replace('"', '')
				.replace('?', '')
				.replace('#', '')
				.replace('!', '')
				.replace('&', 'and')
				.replace(new RegExp(':', 'g'), '')

		// Write the file
		fs.writeFileSync(`games/${filename}.scummvm`, contents, {
			encoding: 'ascii'
		})

		// Calculate the CRC for the entry
		var crcValue = crc.crc32(contents).toString(16)

		// Diplay an output
		console.log(filename, '-', crcValue)

		// Write the rom entry to the .DAT file.
		output += `
game (
	name "${name}"
	description "${name}"
	comment "${id}"
`
		output += `	rom ( name "${filename}.scummvm" size ${contents.length} crc ${crcValue} )\n`
		output += ')\n'
	}
}

// Write the DAT file.
fs.writeFileSync('ScummVM.dat', output, {
	// Make sure to use the ASCII encoding.
	'encoding': 'ascii'
})
