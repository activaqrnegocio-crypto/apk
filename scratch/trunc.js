var fs = require('fs')
var p = 'd:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/src/components/NativeCameraCapture.tsx'
var b = fs.readFileSync(p)
var s = b.toString('utf8')
var i = s.indexOf('[data:cache')
console.log('corruption index:', i)
console.log('size:', b.length)
if (i > 0) {
  fs.writeFileSync(p, b.slice(0, i))
  console.log('truncated to', i)
}