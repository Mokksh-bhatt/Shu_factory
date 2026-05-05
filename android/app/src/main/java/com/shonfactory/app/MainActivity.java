package com.shonfactory.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        // ── Alarm channel — IMPORTANCE_HIGH + USAGE_ALARM ───────────────────
        // This makes the phone ring like an alarm clock and bypass DND
        NotificationChannel alarmChannel = new NotificationChannel(
            "shu_alarm_channel",
            "Factory Alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        alarmChannel.setDescription("Urgent task and message alerts");
        alarmChannel.enableVibration(true);
        alarmChannel.setVibrationPattern(new long[]{0, 600, 200, 600, 200, 600, 200, 1000, 400, 600});
        alarmChannel.enableLights(true);
        alarmChannel.setLightColor(Color.RED);
        alarmChannel.setShowBadge(true);
        alarmChannel.setBypassDnd(true);

        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmSound == null) {
            alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        AudioAttributes audioAttr = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        alarmChannel.setSound(alarmSound, audioAttr);

        nm.createNotificationChannel(alarmChannel);

        // ── Default channel ───────────────────────────────────────────────────
        NotificationChannel defaultChannel = new NotificationChannel(
            "shu_default_channel",
            "General Notifications",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        defaultChannel.enableVibration(true);
        defaultChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
        nm.createNotificationChannel(defaultChannel);
    }
}
