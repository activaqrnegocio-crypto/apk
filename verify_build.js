const fs = require("fs");
const p = "d:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/android/app/build.gradle";
const c = fs.readFileSync(p, "utf8");
console.log("Length:", c.length, "Corruption:", c.includes("[data:cache_control;base64,ZXBoZW1lcmFs]"));