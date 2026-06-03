var fs = require('fs');
var path = 'd:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/android/app';
var items = fs.readdirSync(path);
console.log('Items in app folder:');
items.forEach(function(item) {
    console.log(repr(item));
});

// Find corrupted src folder
items.forEach(function(item) {
    if (item.toLowerCase().indexOf('src') === 0 && item.indexOf('data') > -1) {
        var oldPath = path + '/' + item;
        var newPath = path + '/src';
        console.log('Found: ' + item);
        console.log('Renaming to ' + newPath);
        fs.renameSync(oldPath, newPath);
        console.log('Done!');
    }
});