#!/usr/bin/env python3
content = b'''package com.aquatech.crm;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Load /admin directly on startup
        this.getBridge().getWebView().loadUrl("https://178.238.238.158.sslip.io/admin");
    }
}
'''
with open('android/app/src/main/java/com/aquatech/crm/MainActivity.java', 'wb') as f:
    f.write(content)
print('Written MainActivity.java')