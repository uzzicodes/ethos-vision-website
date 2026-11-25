/* Optional, dependency-free stylesheet assembly. The finished site remains buildless. */
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const layers = ['studio.css','glass.css','polish.css','experience.css','depth.css'];
const output = layers.map(name => fs.readFileSync(path.join(root,'assets',name),'utf8')).join('\n');
fs.writeFileSync(path.join(root,'assets','ethos.css'),output);
console.log(`Built assets/ethos.css (${Buffer.byteLength(output)} bytes).`);
