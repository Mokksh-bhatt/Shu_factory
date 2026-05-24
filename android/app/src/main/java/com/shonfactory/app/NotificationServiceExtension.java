package com.shonfactory.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.onesignal.notifications.INotificationReceivedEvent;
import com.onesignal.notifications.INotificationServiceExtension;
import androidx.annotation.Keep;

// Runs even when the app is completely killed — triggered by every OneSignal push
@Keep
public class NotificationServiceExtension implements INotificationServiceExtension {
    private static final String TAG = "OSNotifExtension";
    public static Ringtone activeRingtone = null;

    @Override
    public void onNotificationReceived(INotificationReceivedEvent event) {
        try {
            Context ctx = event.getContext();
            String title = event.getNotification().getTitle();
            String body  = event.getNotification().getBody();
            if (title == null || title.isEmpty()) title = "Factory Update";
            if (body  == null || body.isEmpty()) body = "Check the app for details";
            
            Log.d(TAG, "Notification Received: " + title + " | " + body);

            String type = "task";
            try {
                org.json.JSONObject additionalData = event.getNotification().getAdditionalData();
                if (additionalData != null && additionalData.has("type")) {
                    type = additionalData.optString("type", "task");
                }
            } catch (Exception ignore) {}

            boolean isChat = "chat".equalsIgnoreCase(type);

            // Play alarm/sound and vibrate ONLY if the app is NOT in the foreground
            if (!com.shonfactory.app.MainActivity.isVisible) {
                if (!isChat) {
                    // 1. Play the alarm ringtone directly (looping)
                    try {
                        if (activeRingtone != null && activeRingtone.isPlaying()) {
                            activeRingtone.stop();
                        }
                        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                        Ringtone ringtone = RingtoneManager.getRingtone(ctx, uri);
                        if (ringtone != null) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                ringtone.setLooping(true);
                            }
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                ringtone.setAudioAttributes(new android.media.AudioAttributes.Builder()
                                    .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                    .build());
                            }
                            ringtone.play();
                            activeRingtone = ringtone;
                        }
                    } catch (Exception ignore) {}

                    // 2. Heavy looping vibration
                    try {
                        Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
                        if (v != null && v.hasVibrator()) {
                            long[] pattern = {0, 600, 200, 600, 200, 1000, 400, 600};
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                                v.vibrate(VibrationEffect.createWaveform(pattern, 0));
                            else
                                v.vibrate(pattern, 0);
                        }
                    } catch (Exception ignore) {}
                } else {
                    // 1. Short notification sound for chat
                    try {
                        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                        Ringtone ringtone = RingtoneManager.getRingtone(ctx, uri);
                        if (ringtone != null) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                ringtone.setAudioAttributes(new android.media.AudioAttributes.Builder()
                                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                    .build());
                            }
                            ringtone.play();
                        }
                    } catch (Exception ignore) {}

                    // 2. Short vibration
                    try {
                        Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
                        if (v != null && v.hasVibrator()) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                                v.vibrate(VibrationEffect.createOneShot(300, VibrationEffect.DEFAULT_AMPLITUDE));
                            else
                                v.vibrate(300);
                        }
                    } catch (Exception ignore) {}
                }
            }

            // 3. Show a notification
            Intent openApp = new Intent(ctx, MainActivity.class);
            openApp.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent openPi = PendingIntent.getActivity(ctx, 0, openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            NotificationCompat.Builder nb;
            if (isChat) {
                nb = new NotificationCompat.Builder(ctx, "shu_chat_channel")
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setAutoCancel(true)
                    .setContentIntent(openPi);
            } else {
                NotificationCompat.Builder taskNb = new NotificationCompat.Builder(ctx, "shu_alarm_channel_v3")
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setAutoCancel(true)
                    .setContentIntent(openPi);
                // Full-screen intent (pops over lock screen) — requires runtime permission on Android 14+
                boolean canFullScreen = true;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    NotificationManager nmCheck = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                    canFullScreen = nmCheck != null && nmCheck.canUseFullScreenIntent();
                }
                if (canFullScreen) {
                    taskNb.setFullScreenIntent(openPi, true);
                }
                nb = taskNb;
            }

            NotificationManager nm = (NotificationManager)
                ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(isChat ? 9002 : 9001, nb.build());

            // Prevent OneSignal from showing its duplicate default notification
            event.preventDefault();

        } catch (Exception e) {
            Log.e(TAG, "Error in NotificationServiceExtension", e);
        }
    }
}
