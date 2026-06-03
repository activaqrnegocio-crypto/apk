var fs = require('fs')
var p = 'd:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/android/app/build.gradle'
var b = fs.readFileSync(p)
var i = b.indexOf(Buffer.from('[data:cache'))
console.log('corruption at', i)
if (i > 0) {
  var clean = b.slice(0, i)
  fs.writeFileSync(p, clean)
  console.log('truncated to', clean.length)
} else {
  console.log('not found, writing last valid portion')
  // Find last valid closing brace
  var lastBrace = b.lastIndexOf(Buffer.from('}'))
  if (lastBrace > 0) {
    fs.writeFileSync(p, b.slice(0, lastBrace + 1))
    console.log('truncated to last valid } at', lastBrace)
  }
}