var fs = require('fs')
var p = 'd:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/android/app/build.gradle'
var b = fs.readFileSync(p)
var idx = b.indexOf(Buffer.from('[data:'))
console.log('found:', idx)
if (idx > 0) {
  fs.writeFileSync(p, b.slice(0, idx))
  console.log('truncated to', idx)
} else {
  console.log('not found')
}