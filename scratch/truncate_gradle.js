var fs = require('fs')
var p = 'd:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/android/app/build.gradle'
var b = fs.readFileSync(p)
console.log('size: ' + b.length)
var i = b.lastIndexOf(Buffer.from('}'))
console.log('last } at: ' + i)
if (i > 0) {
  var clean = b.slice(0, i + 1)
  fs.writeFileSync(p, clean)
  console.log('written, size: ' + clean.length)
}