package com.aquatech.crm;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "AquatechFCM";
    private static final String PREFS_NAME = "AquatechPush";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Manejar el intent de notificación
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    /**
     * Maneja el Intent cuando la notificación es tocada.
     * v428: Guardar en SharedPreferences (compatible con Capacitor Preferences)
     */
    private void handleNotificationIntent(Intent intent) {
        Log.d(TAG, "handleNotificationIntent llamado, intent: " + (intent != null ? "no es null" : "es null"));
        if (intent == null) {
            Log.w(TAG, "Intent es null, saliendo");
            return;
        }
        
        // Log todos los extras para debug
        Bundle extras = intent.getExtras();
        if (extras != null) {
            Log.d(TAG, "Extras size: " + extras.size());
            for (String key : extras.keySet()) {
                Log.d(TAG, "Extra key: " + key + " = " + extras.get(key));
            }
        } else {
            Log.w(TAG, "No hay extras en el intent");
        }
        
        // Support both "push_url" (our custom) and "url" (from server)
        String pushUrl = intent.getStringExtra("push_url");
        if (pushUrl == null) {
            pushUrl = intent.getStringExtra("url");
        }
        String pushTag = intent.getStringExtra("push_tag");
        if (pushTag == null) {
            pushTag = intent.getStringExtra("tag");
        }
        
        Log.d(TAG, "pushUrl extraído: " + (pushUrl != null ? pushUrl : "NULL"));
        
        if (pushUrl != null && !pushUrl.isEmpty()) {
            Log.d(TAG, "Notificación tocada - URL: " + pushUrl + ", Tag: " + pushTag);
            
            // v428: Guardar en SharedPreferences
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit()
                .putString("pending_url", pushUrl)
                .putString("pending_tag", pushTag)
                .putString("has_pending", "true")
                .apply();
            
            Log.d(TAG, "Pending nav guardado en SharedPreferences");
        } else {
            Log.w(TAG, "NO se guardó pending nav porque pushUrl está vacío");
        }
    }
}