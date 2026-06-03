var fs = require('fs')
var b = fs.readFileSync('d:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/android/app/build.gradle')
var search = Buffer.from('ZXBoZW1lcmFs', 'utf8')
var idx = b.indexOf(search)
console.log('idx: ' + idx)
if (idx >= 0) {
  fs.writeFileSync('d:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/android/app/build.gradle', b.slice(0, idx))
  console.log('truncated to ' + idx)
}