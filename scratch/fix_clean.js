var fs = require('fs')
var p = 'd:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/scratch/clean.gradle'
var b = fs.readFileSync(p)
console.log('size: ' + b.length)
// Find the corruption
var search = '[data:cache_control;base64'
for (var i = 0; i < b.length - search.length; i++) {
  var match = true
  for (var j = 0; j < search.length; j++) {
    if (b[i + j] !== search.charCodeAt(j)) {
      match = false
      break
    }
  }
  if (match) {
    console.log('found at ' + i)
    fs.writeFileSync(p, b.slice(0, i))
    console.log('truncated to ' + i)
    break
  }
}
if (i === b.length - search.length) {
  console.log('not found')
  // check last 50 bytes
  console.log('last 50 hex: ' + b.slice(-50).toString('hex'))
}