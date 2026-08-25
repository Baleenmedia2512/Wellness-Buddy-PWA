package com.wellnessvalley.app.plugins;

import android.Manifest;
<<<<<<< HEAD
import android.app.Activity;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
=======
import android.content.ContentProviderOperation;
import android.content.ContentProviderResult;
import android.content.ContentResolver;
import android.content.ContentUris;
>>>>>>> 7e58be05 (feat: add OEM-safe contact insertion for Android with BcmContactsPlugin)
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
<<<<<<< HEAD
import com.getcapacitor.annotation.Permission;
=======
>>>>>>> 7e58be05 (feat: add OEM-safe contact insertion for Android with BcmContactsPlugin)

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
<<<<<<< HEAD
 * BCM device-contact insert. ColorOS/OPPO often rejects community-plugin
 * applyBatch with null account. Try ContentValues insert against known
 * accounts, then open the system Add Contact screen (always works on OEM).
 */
@CapacitorPlugin(
        name = "BcmContacts",
        permissions = {
                @Permission(
                        strings = {
                                Manifest.permission.READ_CONTACTS,
                                Manifest.permission.WRITE_CONTACTS
                        },
                        alias = "contacts"
                )
        }
)
public class BcmContactsPlugin extends Plugin {
    private static final String TAG = "BcmContactsPlugin";
=======
 * OEM-safe contact insert for BCM.
 * ColorOS/OPPO often rejects @capacitor-community/contacts RawContacts insert
 * with explicit null ACCOUNT_NAME/TYPE (JS only sees "Something went wrong").
 */
@CapacitorPlugin(name = "BcmContacts")
public class BcmContactsPlugin extends Plugin {
    private static final String TAG = "BcmContactsPlugin";
    private static final String CONTACTS_AUTHORITY = ContactsContract.AUTHORITY;
>>>>>>> 7e58be05 (feat: add OEM-safe contact insertion for Android with BcmContactsPlugin)

    @PluginMethod
    public void createContact(PluginCall call) {
        String displayName = trimToNull(call.getString("displayName"));
        String phone = trimToNull(call.getString("phone"));
        String note = call.getString("note", "");

        if (displayName == null || phone == null) {
            call.reject("displayName and phone are required");
            return;
        }

<<<<<<< HEAD
        boolean canWrite = ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.WRITE_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED;

        if (canWrite) {
            String contactId = trySilentInsert(displayName, phone, note);
            if (contactId != null && !contactId.isEmpty()) {
                JSObject result = new JSObject();
                result.put("contactId", contactId);
                result.put("openedEditor", false);
                call.resolve(result);
                return;
            }
            Log.w(TAG, "Silent insert failed; opening system contact editor");
        } else {
            Log.w(TAG, "WRITE_CONTACTS not granted; opening system contact editor");
        }

        boolean opened = openSystemContactEditor(displayName, phone, note);
        if (!opened) {
            call.reject("Could not insert contact or open Contacts editor");
            return;
        }
        JSObject result = new JSObject();
        result.put("contactId", "");
        result.put("openedEditor", true);
        call.resolve(result);
    }

    private String trySilentInsert(String displayName, String phone, String note) {
        List<String[]> accounts = buildAccountAttempts();
        for (String[] account : accounts) {
            try {
                String id = insertViaContentValues(displayName, phone, note, account[0], account[1]);
                if (id != null && !id.isEmpty()) {
                    return id;
                }
            } catch (Exception e) {
                Log.w(TAG, "insertViaContentValues failed type=" + account[1], e);
                if (note != null && !note.trim().isEmpty()) {
                    try {
                        String id = insertViaContentValues(displayName, phone, "", account[0], account[1]);
                        if (id != null && !id.isEmpty()) {
                            return id;
                        }
                    } catch (Exception retryErr) {
                        Log.w(TAG, "insert retry without note failed", retryErr);
=======
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
>>>>>>> 7e58be05 (feat: add OEM-safe contact insertion for Android with BcmContactsPlugin)
                    }
                }
            }
        }
<<<<<<< HEAD
        return null;
    }

    private List<String[]> buildAccountAttempts() {
        List<String[]> attempts = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        queryAccounts(ContactsContract.Settings.CONTENT_URI, attempts, seen);
        queryAccounts(ContactsContract.RawContacts.CONTENT_URI, attempts, seen);

        // Local-device first (omit ACCOUNT_* entirely).
        addAttempt(attempts, seen, null, null);
        addAttempt(attempts, seen, "Phone", "com.android.localphone");
        addAttempt(attempts, seen, "Phone", "com.android.contacts.defaultaccount");
        addAttempt(attempts, seen, "Phone", "com.google");
=======

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
>>>>>>> 7e58be05 (feat: add OEM-safe contact insertion for Android with BcmContactsPlugin)
        addAttempt(attempts, seen, "Phone", "com.oppo.contacts");
        addAttempt(attempts, seen, "Phone", "com.oplus.contacts");
        addAttempt(attempts, seen, "Device", "com.android.localphone");
        addAttempt(attempts, seen, "Phone", "vnd.sec.contact.phone");
        return attempts;
    }

<<<<<<< HEAD
    private void queryAccounts(Uri uri, List<String[]> attempts, Set<String> seen) {
        try (Cursor cursor = getContext().getContentResolver().query(
                uri,
                new String[]{
                        ContactsContract.RawContacts.ACCOUNT_NAME,
                        ContactsContract.RawContacts.ACCOUNT_TYPE
                },
                null,
                null,
                null
        )) {
            int n = 0;
            while (cursor != null && cursor.moveToNext() && n < 40) {
                n++;
                addAttempt(attempts, seen, cursor.getString(0), cursor.getString(1));
            }
        } catch (Exception e) {
            Log.w(TAG, "account query failed for " + uri, e);
        }
    }

=======
>>>>>>> 7e58be05 (feat: add OEM-safe contact insertion for Android with BcmContactsPlugin)
    private static void addAttempt(List<String[]> attempts, Set<String> seen, String name, String type) {
        String key = String.valueOf(name) + "\0" + type;
        if (seen.add(key)) {
            attempts.add(new String[]{name, type});
        }
    }

<<<<<<< HEAD
    private String insertViaContentValues(
=======
    private String insertContact(
            ContentResolver resolver,
>>>>>>> 7e58be05 (feat: add OEM-safe contact insertion for Android with BcmContactsPlugin)
            String displayName,
            String phone,
            String note,
            String accountName,
            String accountType
<<<<<<< HEAD
    ) {
        ContentValues raw = new ContentValues();
        if (accountName != null || accountType != null) {
            raw.put(ContactsContract.RawContacts.ACCOUNT_NAME, accountName);
            raw.put(ContactsContract.RawContacts.ACCOUNT_TYPE, accountType);
        }
        Uri rawUri = getContext().getContentResolver().insert(
                ContactsContract.RawContacts.CONTENT_URI, raw
        );
        if (rawUri == null) {
            return null;
        }
        long rawId = ContentUris.parseId(rawUri);

        ContentValues nameValues = new ContentValues();
        nameValues.put(ContactsContract.Data.RAW_CONTACT_ID, rawId);
        nameValues.put(
                ContactsContract.Data.MIMETYPE,
                ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE
        );
        nameValues.put(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, displayName);
        nameValues.put(ContactsContract.CommonDataKinds.StructuredName.GIVEN_NAME, displayName);
        if (getContext().getContentResolver().insert(ContactsContract.Data.CONTENT_URI, nameValues) == null) {
            return null;
        }

        ContentValues phoneValues = new ContentValues();
        phoneValues.put(ContactsContract.Data.RAW_CONTACT_ID, rawId);
        phoneValues.put(
                ContactsContract.Data.MIMETYPE,
                ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE
        );
        phoneValues.put(ContactsContract.CommonDataKinds.Phone.NUMBER, phone);
        phoneValues.put(
                ContactsContract.CommonDataKinds.Phone.TYPE,
                ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE
        );
        if (getContext().getContentResolver().insert(ContactsContract.Data.CONTENT_URI, phoneValues) == null) {
            return null;
        }

        if (note != null && !note.trim().isEmpty()) {
            ContentValues noteValues = new ContentValues();
            noteValues.put(ContactsContract.Data.RAW_CONTACT_ID, rawId);
            noteValues.put(
                    ContactsContract.Data.MIMETYPE,
                    ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE
            );
            noteValues.put(ContactsContract.CommonDataKinds.Note.NOTE, note);
            getContext().getContentResolver().insert(ContactsContract.Data.CONTENT_URI, noteValues);
        }

        try (Cursor cursor = getContext().getContentResolver().query(
=======
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
>>>>>>> 7e58be05 (feat: add OEM-safe contact insertion for Android with BcmContactsPlugin)
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

<<<<<<< HEAD
    private boolean openSystemContactEditor(String displayName, String phone, String note) {
        Activity activity = getActivity();
        if (activity == null) {
            return false;
        }
        Intent intent = new Intent(Intent.ACTION_INSERT);
        intent.setType(ContactsContract.RawContacts.CONTENT_TYPE);
        intent.putExtra(ContactsContract.Intents.Insert.NAME, displayName);
        intent.putExtra(ContactsContract.Intents.Insert.PHONE, phone);
        intent.putExtra(
                ContactsContract.Intents.Insert.PHONE_TYPE,
                ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE
        );
        if (note != null && !note.trim().isEmpty()) {
            intent.putExtra(ContactsContract.Intents.Insert.NOTES, note);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            activity.runOnUiThread(() -> activity.startActivity(intent));
            return true;
        } catch (Exception e) {
            Log.e(TAG, "startActivity Add Contact failed", e);
            return false;
        }
    }

=======
>>>>>>> 7e58be05 (feat: add OEM-safe contact insertion for Android with BcmContactsPlugin)
    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
