const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../web/assistant/styles');
const destDir = path.resolve(__dirname, '../media/assistant/styles');

function ensureDir(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function copyStyles() {
	ensureDir(destDir);
	const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.css'));
	files.forEach((file) => {
		fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
	});
	console.log(`Copied assistant styles: ${files.join(', ')}`);
}

copyStyles();



















