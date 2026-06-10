package com.aquatech.crm;

import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileReader;
import java.io.BufferedReader;

/**
 * Plugin de Capacitor para leer pending navigation desde archivo JSON.
 * Este archivo es escrito por MainActivity cuando se toca una notificación.
 */
@CapacitorPlugin()
public class PendingNavPlugin extends Plugin {
    
    private static final String TAG = "PendingNavPlugin";
    private static final String PENDING_NAV_FILE = "pending_nav.json";

    /**
     * Lee y elimina el pending navigation.
     * Retorna null si no hay navegación pendiente.
     */
    @PluginMethod
    public void getAndClearPendingNav(PluginCall call) {
        try {
            File file = new File(getContext().getFilesDir(), PENDING_NAV_FILE);
            
            if (!file.exists()) {
                call.resolve(new JSObject());
                return;
            }
            
            // Leer el contenido
            StringBuilder json = new StringBuilder();
            BufferedReader reader = new BufferedReader(new FileReader(file));
            String line;
            while ((line = reader.readLine()) != null) {
                json.append(line);
            }
            reader.close();
            
            String content = json.toString();
            Log.d(TAG, "Pending nav encontrado (RAW): '" + content + "'");
            Log.d(TAG, "Content length: " + content.length());
            
            // v452: NO eliminar - dejar que JavaScript lo maneje
            // El archivo queda hasta que se naviga exitosamente
            
            // Parsear y retornar
            JSObject result = new JSObject();
            
            // Simple parse - buscar url y tag
            if (content.contains("\"url\":")) {
                int urlStart = content.indexOf("\"url\":\"") + 6;
                int urlEnd = content.indexOf("\"", urlStart);
                Log.d(TAG, "urlStart: " + urlStart + ", urlEnd: " + urlEnd);
                if (urlEnd > urlStart) {
                    String url = content.substring(urlStart, urlEnd);
                    Log.d(TAG, "URL extraída: '" + url + "'");
                    result.put("url", url);
                }
            }
            if (content.contains("\"tag\":")) {
                int tagStart = content.indexOf("\"tag\":\"") + 6;
                int tagEnd = content.indexOf("\"", tagStart);
                if (tagEnd > tagStart) {
                    result.put("tag", content.substring(tagStart, tagEnd));
                }
            }
            
            Log.d(TAG, "Resultado JSObject: " + result.toString());
            
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Error leyendo pending nav: " + e.getMessage());
            call.reject("Error: " + e.getMessage());
        }
    }
}