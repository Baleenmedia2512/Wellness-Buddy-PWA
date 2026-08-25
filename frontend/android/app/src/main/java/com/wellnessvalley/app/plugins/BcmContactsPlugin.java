package com.wellnessvalley.app.plugins;

import android.Manifest;
import android.content.ContentProviderOperation;
import android.content.ContentProviderResult;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * OEM-safe contact insert for BCM.
 * ColorOS/OPPO often rejects @capacitor-community/contacts RawContacts insert
 * with explicit null ACCOUNT_NAME/TYPE (JS only sees "Something went wrong").
 */
@CapacitorPlugin(name = "BcmContacts")
public class BcmContactsPlugin extends Plugin {
    private static final String TAG = "BcmContactsPlugin";
    private static final String CONTACTS_AUTHORITY = ContactsContract.AUTHORITY;

    @PluginMethod
    public void createContact(PluginCall call) {
        String displayName = trimToNull(call.getString("displayName"));
        String phone = trimToNull(call.getString("phone"));
        String note = call.getString("note", "");

        if (displayName == null || phone == null) {
            call.reject("displayName and phone are required");
            return;
        }

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_CONTACTS)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("WRITE_CONTACTS not granted");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        List<String[]> accountAttempts = buildAccountAttempts(resolver);

        Exception lastError = null;
        for (String[] account : accountAttempts) {
            try {
                String contactId = insertContact(
                        resolver, displayName, phone, note, account[0], account[1]
                );
                if (contactId != null && !contactId.isEmpty()) {
                    JSObject result = new JSObject();
                    result.put("contactId", contactId);
                    result.put("accountType", account[1] == null ? "" : account[1]);
                    call.resolve(result);
                    return;
                }
            } catch (Exception e) {
                lastError = e;
                Log.w(TAG, "createContact attempt failed accountType=" + account[1], e);
                if (note != null && !note.trim().isEmpty()) {
                    try {
                        String contactId = insertContact(
                                resolver, displayName, phone, "", account[0], account[1]
                        );
                        if (contactId != null && !contactId.isEmpty()) {
                            JSObject result = new JSObject();
                            result.put("contactId", contactId);
                            result.put("accountType", account[1] == null ? "" : account[1]);
                            call.resolve(result);
                            return;
                        }
                    } catch (Exception retryErr) {
                        lastError = retryErr;
                    }
                }
            }
        }

        String detail = lastError != null ? lastError.getMessage() : "insert returned no contact id";
        Log.e(TAG, "createContact failed after " + accountAttempts.size() + " attempts: " + detail);
        call.reject("BCM contact insert failed: " + detail, lastError);
    }

    private List<String[]> buildAccountAttempts(ContentResolver resolver) {
        List<String[]> attempts = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        try (Cursor cursor = resolver.query(
                ContactsContract.RawContacts.CONTENT_URI,
                new String[]{
                    ContactsContract.RawContacts.ACCOUNT_NAME,
                    ContactsContract.RawContacts.ACCOUNT_TYPE
                },
                ContactsContract.RawContacts.DELETED + "=0",
                null,
                ContactsContract.RawContacts._ID + " DESC"
        )) {
            int n = 0;
            while (cursor != null && cursor.moveToNext() && n < 40) {
                n++;
                String name = cursor.getString(0);
                String type = cursor.getString(1);
                String key = String.valueOf(name) + "\0" + type;
                if (seen.add(key)) {
                    attempts.add(new String[]{name, type});
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not read existing contact accounts", e);
        }

        addAttempt(attempts, seen, null, null);
        addAttempt(attempts, seen, "Phone", "com.android.localphone");
        addAttempt(attempts, seen, "Phone", "com.android.contacts.defaultaccount");
        addAttempt(attempts, seen, "Phone", "com.oppo.contacts");
        addAttempt(attempts, seen, "Phone", "com.oplus.contacts");
        addAttempt(attempts, seen, "Device", "com.android.localphone");
        addAttempt(attempts, seen, "Phone", "vnd.sec.contact.phone");
        return attempts;
    }

    private static void addAttempt(List<String[]> attempts, Set<String> seen, String name, String type) {
        String key = String.valueOf(name) + "\0" + type;
        if (seen.add(key)) {
            attempts.add(new String[]{name, type});
        }
    }

    private String insertContact(
            ContentResolver resolver,
            String displayName,
            String phone,
            String note,
            String accountName,
            String accountType
    ) throws Exception {
        ArrayList<ContentProviderOperation> ops = new ArrayList<>();

        // Do not write explicit null ACCOUNT_* — ColorOS rejects that insert.
        ContentProviderOperation.Builder raw = ContentProviderOperation
                .newInsert(ContactsContract.RawContacts.CONTENT_URI);
        if (accountName != null || accountType != null) {
            raw.withValue(ContactsContract.RawContacts.ACCOUNT_NAME, accountName);
            raw.withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, accountType);
        }
        ops.add(raw.build());

        ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, displayName)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.GIVEN_NAME, displayName)
                .build());

        ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, phone)
                .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
                .build());

        if (note != null && !note.trim().isEmpty()) {
            ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.Note.NOTE, note)
                    .build());
        }

        ContentProviderResult[] results = resolver.applyBatch(CONTACTS_AUTHORITY, ops);
        if (results == null || results.length == 0 || results[0].uri == null) {
            return null;
        }

        Uri rawUri = results[0].uri;
        long rawId = ContentUris.parseId(rawUri);
        try (Cursor cursor = resolver.query(
                ContentUris.withAppendedId(ContactsContract.RawContacts.CONTENT_URI, rawId),
                new String[]{ContactsContract.RawContacts.CONTACT_ID},
                null,
                null,
                null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                String contactId = cursor.getString(0);
                if (contactId != null && !contactId.isEmpty()) {
                    return contactId;
                }
            }
        }
        return String.valueOf(rawId);
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
