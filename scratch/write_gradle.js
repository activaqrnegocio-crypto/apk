var fs = require('fs');
var p = 'd:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/android/app/build.gradle';
var content = `apply from: 'variables.gradle'

android {
    namespace 'com.aquatech.crm'
    compileSdk 34

    defaultConfig {
        applicationId "com.aquatech.crm"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
        buildConfigField "String", "CAPACITOR_PLATFORM_NAME", "\\"android\\""
        buildConfigField "String", "CAPACITOR_BUILT_VERSION", "\\"1\\""
    }

    lint {
        abortOnError false
        ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~"
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}

dependencies {
    implementation fileTree(dir: 'src/main', include: ['*.jar'])
    implementation project(':capacitor-android')
    implementation project(':capacitor-cordova-android-plugins')
}
`;
fs.writeFileSync(p, content);
console.log('written, size:', fs.statSync(p).size);