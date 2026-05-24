package com.shonfactory.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.content.Intent;
import android.os.PowerManager;
import android.provider.Settings;
import android.content.Context;
import androidx.core.content.ContextCompat;

public class MainActivity extends BridgeActivity {
    public static boolean isVisible = false;

    @Override
    public void onStart() {
        super.onStart();
        isVisible = true;
    }

    @Override
    public void onStop() {
        super.onStop();
        isVisible = false;
    }

    @Override
    public void onResume() {
        super.onResume();
        isVisible = true;
        // Stop any active looping alarms when the user opens the app
        try {
            if (NotificationServiceExtension.activeRingtone != null && NotificationServiceExtension.activeRingtone.isPlaying()) {
                NotificationServiceExtension.activeRingtone.stop();
                NotificationServiceExtension.activeRingtone = null;
            }
        } catch (Exception ignore) {}
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShuHelperPlugin.class);
        super.onCreate(savedInstanceState);
        
        // Show over lockscreen and turn screen on for urgent alarms
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
            android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
            | android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            | android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            | android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );

        createNotificationChannels();
    }

    @CapacitorPlugin(name = "ShuHelper")
    public static class ShuHelperPlugin extends Plugin {
        @PluginMethod
        public void openBatterySettings(PluginCall call) {
            android.util.Log.d("ShuHelper", "openBatterySettings called");
            try {
                Intent intent = new Intent();
                intent.setAction(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e) {
                android.util.Log.e("ShuHelper", "Failed to open battery settings", e);
                openAppSettings(null);
            }
            if (call != null) call.resolve();
        }

        @PluginMethod
        public void openOverlaySettings(PluginCall call) {
            android.util.Log.d("ShuHelper", "openOverlaySettings: entering method");
            boolean success = false;
            
            // 1. Try standard overlay settings with package
            try {
                android.util.Log.d("ShuHelper", "openOverlaySettings: attempting standard intent with package");
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                android.util.Log.d("ShuHelper", "openOverlaySettings: standard intent with package SUCCESS");
                success = true;
            } catch (Exception e) {
                android.util.Log.e("ShuHelper", "openOverlaySettings: standard intent with package FAILED", e);
            }

            // 2. Xiaomi fallback for "Display pop-up windows while running in background"
            if (!success) {
                try {
                    android.util.Log.d("ShuHelper", "openOverlaySettings: attempting Xiaomi-specific intent");
                    Intent intent = new Intent("miui.intent.action.APP_PERM_EDITOR");
                    intent.setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity");
                    intent.putExtra("extra_pkgname", getContext().getPackageName());
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    android.util.Log.d("ShuHelper", "openOverlaySettings: Xiaomi-specific intent SUCCESS");
                    success = true;
                } catch (Exception e) {
                    android.util.Log.e("ShuHelper", "openOverlaySettings: Xiaomi-specific intent FAILED", e);
                }
            }

            // 3. Final fallback: just open standard list
            if (!success) {
                try {
                    android.util.Log.d("ShuHelper", "openOverlaySettings: attempting standard intent WITHOUT package");
                    Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    android.util.Log.d("ShuHelper", "openOverlaySettings: standard intent WITHOUT package SUCCESS");
                    success = true;
                } catch (Exception e) {
                    android.util.Log.e("ShuHelper", "openOverlaySettings: standard intent WITHOUT package FAILED");
                    openAppSettings(null);
                }
            }
            
            android.util.Log.d("ShuHelper", "openOverlaySettings: exiting method, success=" + success);
            if (call != null) call.resolve();
        }

        @PluginMethod
        public void openAppSettings(PluginCall call) {
            android.util.Log.d("ShuHelper", "openAppSettings called");
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e) {
                android.util.Log.e("ShuHelper", "Critical: Failed to open app settings", e);
            }
            if (call != null) call.resolve();
        }

        @PluginMethod
        public void checkPermissions(PluginCall call) {
            JSObject ret = new JSObject();
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ret.put("batteryOk", pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
            ret.put("overlayOk", Settings.canDrawOverlays(getContext()));
            call.resolve(ret);
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        // Alarm channel v3 — has real alarm sound so MIUI treats it as urgent
        Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmUri == null) alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes alarmAttr = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        NotificationChannel alarmCh = new NotificationChannel(
            "shu_alarm_channel_v3", "Factory Alarms", NotificationManager.IMPORTANCE_HIGH);
        alarmCh.setDescription("Urgent task alerts");
        alarmCh.setSound(alarmUri, alarmAttr);
        alarmCh.enableVibration(true);
        alarmCh.setVibrationPattern(new long[]{0, 600, 200, 600, 200, 1000, 400, 600});
        alarmCh.enableLights(true);
        alarmCh.setLightColor(Color.RED);
        alarmCh.setShowBadge(true);
        alarmCh.setBypassDnd(true);
        nm.createNotificationChannel(alarmCh);

        // Chat channel — sound=null here, handled in the extension
        NotificationChannel chatCh = new NotificationChannel(
            "shu_chat_channel", "Factory Chat", NotificationManager.IMPORTANCE_HIGH);
        chatCh.setDescription("New chat messages");
        chatCh.enableVibration(false); // Manually handled
        chatCh.enableLights(true);
        chatCh.setLightColor(Color.GREEN);
        chatCh.setShowBadge(true);
        chatCh.setSound(null, null); // Stop double sounds
        nm.createNotificationChannel(chatCh);

        // Silent channel for non-urgent notifications
        NotificationChannel defCh = new NotificationChannel(
            "shu_default_channel", "General Notifications", NotificationManager.IMPORTANCE_MIN);
        defCh.setDescription("Background service indicator");
        defCh.enableVibration(false);
        defCh.setSound(null, null);
        nm.createNotificationChannel(defCh);
    }
}
