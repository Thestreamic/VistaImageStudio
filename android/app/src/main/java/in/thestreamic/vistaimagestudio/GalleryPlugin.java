package in.thestreamic.vistaimagestudio;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Saves an exported image into the shared gallery under Pictures/Vista Image Studio.
 *
 * Android 10+ (API 29+): MediaStore insert of the app's own file, no permission.
 * Android 7-9 (API 24-28): WRITE_EXTERNAL_STORAGE, declared with maxSdkVersion=28.
 * The app never reads the user's library, so READ_MEDIA_IMAGES is not requested
 * (Google Play restricts it to gallery-type apps).
 */
@CapacitorPlugin(
    name = "VistaGallery",
    permissions = {
        @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = "storage")
    }
)
public class GalleryPlugin extends Plugin {

    private static final String ALBUM = "Vista Image Studio";

    @PluginMethod
    public void saveImage(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }
        saveInBackground(call);
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            saveInBackground(call);
        } else {
            call.reject("Storage permission is needed to save to the gallery on this Android version.", "PERMISSION_DENIED");
        }
    }

    private void saveInBackground(PluginCall call) {
        String data = call.getString("data");
        String fileName = call.getString("fileName", "vista-" + System.currentTimeMillis() + ".jpg");
        String mimeType = call.getString("mimeType", "image/jpeg");
        if (data == null || data.isEmpty()) {
            call.reject("No image data", "NO_DATA");
            return;
        }
        getBridge().execute(() -> {
            try {
                int comma = data.indexOf(',');
                byte[] bytes = Base64.decode(comma >= 0 ? data.substring(comma + 1) : data, Base64.DEFAULT);
                String uri = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? saveWithMediaStore(bytes, fileName, mimeType)
                    : saveLegacy(bytes, fileName, mimeType);
                JSObject result = new JSObject();
                result.put("uri", uri);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Could not save to the gallery: " + e.getMessage(), "SAVE_FAILED", e);
            }
        });
    }

    private String saveWithMediaStore(byte[] bytes, String fileName, String mimeType) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + ALBUM);
        values.put(MediaStore.Images.Media.IS_PENDING, 1);
        Uri collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri item = resolver.insert(collection, values);
        if (item == null) throw new IllegalStateException("MediaStore insert failed");
        try (OutputStream out = resolver.openOutputStream(item)) {
            if (out == null) throw new IllegalStateException("Could not open the gallery file");
            out.write(bytes);
        } catch (Exception e) {
            resolver.delete(item, null, null);
            throw e;
        }
        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        resolver.update(item, values, null, null);
        return item.toString();
    }

    @SuppressWarnings("deprecation")
    private String saveLegacy(byte[] bytes, String fileName, String mimeType) throws Exception {
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), ALBUM);
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Could not create " + dir);
        File file = new File(dir, fileName);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        MediaScannerConnection.scanFile(getContext(), new String[] { file.getAbsolutePath() }, new String[] { mimeType }, null);
        return Uri.fromFile(file).toString();
    }
}
