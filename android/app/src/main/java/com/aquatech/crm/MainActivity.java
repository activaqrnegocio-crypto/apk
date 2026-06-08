package com.aquatech.crm;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.BufferedReader;
import java.io.FileReader;

import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "AquatechFCM";
    private static final String PENDING_NAV_FILE = "pending_nav.json";
    
    // v418: Variable para almacenar pending nav leída al inicio
    private JSONObject pendingNavJson = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Leer pending nav desde archivo antes de manejar el intent
        leerPendingNav();
        
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
     * Lee pending nav desde archivo al inicio.
     */
    private void leerPendingNav() {
        try {
            File file = new File(getFilesDir(), PENDING_NAV_FILE);
            if (file.exists()) {
                StringBuilder json = new StringBuilder();
                BufferedReader reader = new BufferedReader(new FileReader(file));
                String line;
                while ((line = reader.readLine()) != null) {
                    json.append(line);
                }
                reader.close();
                
                String content = json.toString();
                if (content.length() > 0) {
                    pendingNavJson = new JSONObject(content);
                    Log.d(TAG, "Pending nav leído desde archivo: " + content);
                    
                    // Eliminar el archivo después de leerlo
                    file.delete();
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error leyendo pending nav: " + e.getMessage());
        }
    }

    /**
     * Maneja el Intent cuando la notificación es tocada.
     * v418: Guardar en archivo JSON para que el frontend lo lea.
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
            
            // Guardar en archivo JSON para que el frontend lo lea
            guardarPendingNav(pushUrl, pushTag);
        }
    }

    /**
     * Guarda la navegación pendiente en un archivo JSON.
     */
    private void guardarPendingNav(String url, String tag) {
        try {
            String json = String.format(
                "{\"url\":\"%s\",\"tag\":\"%s\",\"timestamp\":%d}",
                url.replace("\"", "\\\""),
                tag != null ? tag.replace("\"", "\\\"") : "",
                System.currentTimeMillis()
            );
            
            File file = new File(getFilesDir(), PENDING_NAV_FILE);
            FileOutputStream fos = new FileOutputStream(file);
            OutputStreamWriter writer = new OutputStreamWriter(fos, "UTF-8");
            writer.write(json);
            writer.close();
            fos.close();
            
            Log.d(TAG, "Pending nav guardado en archivo: " + json);
        } catch (Exception e) {
            Log.e(TAG, "Error guardando pending nav: " + e.getMessage());
        }
    }

    /**
     * Expone un método JavaScript para que el frontend lea el pending nav.
     * Llamar desde JS: window.AndroidPendingNav.getPendingNav()
     */
    @JavascriptInterface
    public String getPendingNav() {
        if (pendingNavJson != null) {
            String result = pendingNavJson.toString();
            pendingNavJson = null; // Consumir solo una vez
            return result;
        }
        
        // Si no hay nada en memoria, intentar leer del archivo
        try {
            File file = new File(getFilesDir(), PENDING_NAV_FILE);
            if (file.exists()) {
                StringBuilder json = new StringBuilder();
                BufferedReader reader = new BufferedReader(new FileReader(file));
                String line;
                while ((line = reader.readLine()) != null) {
                    json.append(line);
                }
                reader.close();
                file.delete();
                return json.toString();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error en getPendingNav: " + e.getMessage());
        }
        
        return null;
    }
}
