package com.aquatech.crm;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "AquatechFCM";
    private static final String PREFS_NAME = "AquatechPush";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        
        String pushUrl = intent.getStringExtra("push_url");
        String pushTag = intent.getStringExtra("push_tag");
        
        if (pushUrl != null && !pushUrl.isEmpty()) {
            Log.d(TAG, "Notificación tocada - URL: " + pushUrl + ", Tag: " + pushTag);
            
            // Guardar URL en SharedPreferences para que el frontend la lea
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putString("pending_url", pushUrl)
                .putString("pending_tag", pushTag)
                .putBoolean("has_pending", true)
                .apply();
        }
    }
}
