const readline = require('readline');
const fs = require('fs');

try {
	fs.mkdirSync('games')
}
catch (e) {
	throw '"games" directory already exists. Delete it first.'
}

const rl = readline.createInterface({
  input: fs.createReadStream('scummvm.txt')
});

rl.on('line', function (line) {
  var parts = line.split('|')
  var title = parts[0].replace('/', ' - ').replace('?', '').replace(new RegExp(':', 'g'), '')
  var slug = parts[1]
  fs.writeFileSync('games/' + title + '.scummvm', slug);
});

