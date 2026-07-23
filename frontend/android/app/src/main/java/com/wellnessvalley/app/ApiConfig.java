package com.wellnessvalley.app;

/**
 * Native mirror of frontend REACT_APP_API_BASE_URL.
 * Value is injected at Gradle build from .env.production / .env (see app/build.gradle).
 */
public final class ApiConfig {

    /** Same as JS getApiBaseUrl() — from REACT_APP_API_BASE_URL at build time. */
    public static final String DEFAULT_API_BASE_URL = BuildConfig.API_BASE_URL;

    private ApiConfig() {
    }

    public static String getDefaultApiBaseUrl() {
        return normalizeBaseUrl(DEFAULT_API_BASE_URL);
    }

    public static String normalizeBaseUrl(String url) {
        if (url == null) {
            return getDefaultApiBaseUrl();
        }
        String trimmed = url.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed.isEmpty() ? getDefaultApiBaseUrl() : trimmed;
    }

    /** Hostname for App Links / deep links (derived from API base URL). */
    public static String getDefaultApiHost() {
        try {
            return new java.net.URL(getDefaultApiBaseUrl()).getHost();
        } catch (Exception e) {
            return "wellness-valley.vercel.app";
        }
    }
}
