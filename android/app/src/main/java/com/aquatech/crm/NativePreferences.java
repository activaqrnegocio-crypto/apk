package com.aquatech.crm;

import android.content.SharedPreferences;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;

/**
 * Plugin para leer SharedPreferences nativas directamente.
 * Usa las mismas prefs que MainActivity para pending_push_route.
 */
public class NativePreferences extends Plugin {
    
    private static final String TAG = "NativePreferences";
    private static final String PREFS_NAME = "aquatech_push"; // Mismo nombre que MainActivity

    /**
     * Lee un valor de SharedPreferences
     */
    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key");
        
        if (key == null || key.isEmpty()) {
            call.reject("Key is required");
            return;
        }
        
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
            String value = prefs.getString(key, null);
            
            JSObject result = new JSObject();
            result.put("value", value);
            
            Log.d(TAG, "Get '" + key + "': " + value);
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Error getting preference: " + e.getMessage());
            call.reject("Error: " + e.getMessage());
        }
    }
    
    /**
     * Guarda un valor en SharedPreferences
     */
    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        
        if (key == null || key.isEmpty()) {
            call.reject("Key is required");
            return;
        }
        
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
            prefs.edit().putString(key, value).apply();
            
            Log.d(TAG, "Set '" + key + "': " + value);
            call.resolve();
            
        } catch (Exception e) {
            Log.e(TAG, "Error setting preference: " + e.getMessage());
            call.reject("Error: " + e.getMessage());
        }
    }
    
    /**
     * Elimina un valor de SharedPreferences
     */
    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");
        
        if (key == null || key.isEmpty()) {
            call.reject("Key is required");
            return;
        }
        
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
            prefs.edit().remove(key).apply();
            
            Log.d(TAG, "Remove '" + key + "'");
            call.resolve();
            
        } catch (Exception e) {
            Log.e(TAG, "Error removing preference: " + e.getMessage());
            call.reject("Error: " + e.getMessage());
        }
    }
}