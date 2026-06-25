package com.wellnessvalley.app.services;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.HashSet;
import java.util.Set;

public class FoodImageQueue {
    private static final String PREFS_NAME = "FoodImageQueuePrefs";
    private static final String KEY_QUEUE = "imageQueue";
    private SharedPreferences prefs;

    public FoodImageQueue(Context context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public void add(String imagePath) {
        Set<String> queue = getQueue();
        queue.add(imagePath);
        prefs.edit().putStringSet(KEY_QUEUE, queue).apply();
    }

    public Set<String> getQueue() {
        return new HashSet<>(prefs.getStringSet(KEY_QUEUE, new HashSet<>()));
    }

    public void remove(String imagePath) {
        Set<String> queue = getQueue();
        queue.remove(imagePath);
        prefs.edit().putStringSet(KEY_QUEUE, queue).apply();
    }

    public void clear() {
        prefs.edit().remove(KEY_QUEUE).apply();
    }
}
