const fs = require('fs');
const exec = require('child_process').execSync
const crc = require('crc')
const rimraf = require('rimraf')
const pkg = require('./package.json')

// Clean the games directory.
rimraf.sync('games')
fs.mkdirSync('games')

function crc32(input) {
	return crc.crc32(input).toString(16)
}

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
			console.log(title + ': ' + name)
  			fs.writeFileSync(`games/${title}.scummvm`, name);

  			// Write the ROM entry
  			output += `
game (
	name "${title}"
	description "${title}"
	rom ( name "${title}.scummvm" size ${name.length} crc ${crc32(name)} )
)
`
  		}
	})

// Write the DAT file.
fs.writeFileSync('ScummVM.dat', output)
