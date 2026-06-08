package com.aquatech.crm;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.os.Environment;

import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileWriter;
import java.io.FileReader;
import java.io.IOException;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "AquatechFCM";
    private static final String PENDING_NAV_FILE = "pending_nav.json";

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
     * v419: Guardar en archivo JSON (compatible con Capacitor Filesystem)
     */
    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        
        // Support both "push_url" (our custom) and "url" (from server)
        String pushUrl = intent.getStringExtra("push_url");
        if (pushUrl == null) {
            pushUrl = intent.getStringExtra("url");
        }
        String pushTag = intent.getStringExtra("push_tag");
        if (pushTag == null) {
            pushTag = intent.getStringExtra("tag");
        }
        
        if (pushUrl != null && !pushUrl.isEmpty()) {
            Log.d(TAG, "Notificación tocada - URL: " + pushUrl + ", Tag: " + pushTag);
            
            // Guardar en archivo JSON (que Capacitor Filesystem puede leer)
            savePendingNavToFile(pushUrl, pushTag);
            
            Log.d(TAG, "Pending nav guardado en archivo JSON");
        }
    }
    
    /**
     * Guarda el pending navigation en un archivo JSON.
     * Este archivo puede ser leído por el frontend usando Capacitor Filesystem.
     */
    private void savePendingNavToFile(String url, String tag) {
        try {
            // Usar el directorio de archivos internos de la app
            File file = new File(getFilesDir(), PENDING_NAV_FILE);
            
            // Crear contenido JSON
            String json = "{\n" +
                "  \"url\": \"" + escapeJson(url) + "\",\n" +
                "  \"tag\": \"" + escapeJson(tag) + "\",\n" +
                "  \"has_pending\": true\n" +
                "}";
            
            FileWriter writer = new FileWriter(file);
            writer.write(json);
            writer.close();
            
            Log.d(TAG, "Archivo JSON creado: " + file.getAbsolutePath());
        } catch (IOException e) {
            Log.e(TAG, "Error guardando pending nav: " + e.getMessage());
        }
    }
    
    /**
     * Escapa caracteres para JSON.
     */
    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
               .replace("\"", "\\\"")
               .replace("\n", "\\n")
               .replace("\r", "\\r")
               .replace("\t", "\\t");
    }
}
