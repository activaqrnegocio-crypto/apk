package com.aquatech.crm;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Servicio de Firebase Cloud Messaging para Aquatech CRM
 * 
 * Este servicio recibe los data messages de FCM y crea notificaciones locales Android.
 * Esto resuelve el problema de que las notificaciones NO aparecen cuando la app está en foreground.
 * 
 * Arquitectura:
 * FCM Data Message → onMessageReceived() → Notificación Local Android → Mostrar siempre
 */
public class AquatechFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "AquatechFCM";
    
    // Channel ID para Android 8+
    public static final String CHANNEL_ID = "aquatech_foreground_channel";
    public static final String CHANNEL_NAME = "Notificaciones Aquatech";
    public static final int NOTIFICATION_ID = 5200;

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "Nuevo token FCM: " + token);
        // Aquí podrías guardar el token y enviarlo al servidor
    }

    /**
     * Este método es llamado cuando llega un mensaje de FCM.
     * Aquí controlamos TODO: foreground, background, o app cerrada.
     * 
     * @param remoteMessage El mensaje recibido de FCM
     */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        Log.d(TAG, "Mensaje FCM recibido desde: " + remoteMessage.getFrom());
        Log.d(TAG, "Mensaje data: " + remoteMessage.getData());
        
        // Verificar si hay datos
        if (remoteMessage.getData().size() > 0) {
            Log.d(TAG, "Procesando data message...");
            procesarDataMessage(remoteMessage);
        } else {
            Log.w(TAG, "Mensaje sin datos recibidos");
        }
    }

    /**
     * Procesa el data message y crea una notificación local Android.
     * Esto es lo que hace que las notificaciones aparezcan incluso en foreground.
     */
    private void procesarDataMessage(RemoteMessage remoteMessage) {
        // Extraer datos del mensaje
        String title = remoteMessage.getData().get("custom_title");
        String body = remoteMessage.getData().get("custom_body");
        String url = remoteMessage.getData().get("url");
        String tag = remoteMessage.getData().get("tag");
        
        // Valores por defecto
        if (title == null || title.isEmpty()) {
            title = "Aquatech CRM";
        }
        if (body == null || body.isEmpty()) {
            body = "Nueva notificación";
        }
        if (url == null || url.isEmpty()) {
            url = "/admin/operador";
        }
        if (tag == null || tag.isEmpty()) {
            tag = "default";
        }
        
        Log.d(TAG, "Mostrando notificación - Title: " + title + ", Body: " + body);
        
        // Crear intent para cuando el usuario toque la notificación
        Intent intent = new Intent(this, BridgeActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("push_url", url);
        intent.putExtra("push_tag", tag);
        
        // PendingIntent para mantener el intent pendiente
        int requestCode = (int) System.currentTimeMillis();
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Construir la notificación
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon) // Icono de la app
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        
        // Usar color primario si está disponible
        try {
            builder.setColor(getColor(getApplicationInfo().icon));
        } catch (Exception e) {
            // Ignorar si no se puede obtener el color
        }
        
        // Crear el canal de notificación (requerido para Android 8+)
        crearCanalNotificacion();
        
        // Mostrar la notificación
        NotificationManager notificationManager = 
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        
        if (notificationManager != null) {
            // Usar tag para evitar duplicados
            notificationManager.notify(tag, NOTIFICATION_ID, builder.build());
            Log.d(TAG, "Notificación local mostrada con tag: " + tag);
        }
    }

    /**
     * Crea el canal de notificación para Android 8+ (API 26+)
     */
    private void crearCanalNotificacion() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificaciones de Aquatech CRM");
            channel.enableVibration(true);
            channel.setShowBadge(true);
            
            NotificationManager notificationManager = 
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
                Log.d(TAG, "Canal de notificación creado");
            }
        }
    }
}
