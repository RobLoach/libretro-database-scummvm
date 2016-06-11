const fs = require('fs');
const exec = require('child_process').execSync

// Clear the "games" directory.
try {
	fs.readdirSync('games').forEach(function (file) {
		fs.unlinkSync('games/' + file);
	})
	fs.rmdirSync('games')
}
catch (e) {
	// Nothing
}

// Create the games directory.
fs.mkdirSync('games')

// Build the .scummvm files.
exec('scummvm --list-games')
	// Port the Buffer to a string.
	.toString()
	// Split it into an array.
	.split('\n')
	// Remove the first two elements (header and line devision)
	.splice(2)
	// Loop through each one an make the .scummvm file
	.forEach(function (line) {
		var name = line.substring(0, 20).trim()
		var title = line.substring(20).replace('/', ' - ').replace('?', '').replace(new RegExp(':', 'g'), '').trim()
		if (name.length > 0) {
			console.log(title + ': ' + name)
  			fs.writeFileSync('games/' + title + '.scummvm', name);
  		}
	})
