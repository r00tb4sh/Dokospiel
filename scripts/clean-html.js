const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../dist/index.html');
let content = fs.readFileSync(filePath, 'utf8');

const startTag = '<!-- VITE_ONLY_START -->';
const endTag = '<!-- VITE_ONLY_END -->';

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = content.slice(0, startIndex) + content.slice(endIndex + endTag.length);
    fs.writeFileSync(filePath, newContent);
    console.log('Successfully cleaned index.html');
} else {
    console.log('Markers not found in index.html');
}
