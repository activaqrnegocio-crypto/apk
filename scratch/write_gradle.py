import os
p = r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\android\app\build.gradle'
content = """apply from: 'variables.gradle'

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
"""
with open(p, 'w', encoding='utf-8') as f:
    f.write(content)
print('written, size:', os.path.getsize(p))
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
"""
with open(p, 'w', encoding='utf-8') as f:
    f.write(content)
print('written, size:', os.path.getsize(p))