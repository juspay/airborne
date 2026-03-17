// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package in.juspay.airborne.services;

import android.content.Context;
import android.os.Build;
import android.os.Environment;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.jetbrains.annotations.NotNull;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import in.juspay.airborne.TrackerCallback;
import in.juspay.airborne.utils.OTAUtils;
import in.juspay.hyperutil.FileUtilCallback;
import in.juspay.hyperutil.HyperFileUtil;
import in.juspay.airborne.constants.Labels;
import in.juspay.airborne.constants.LogCategory;
import in.juspay.airborne.constants.LogLevel;
import in.juspay.airborne.constants.LogSubCategory;

/**
 * A class that contains helper methods for files.
 *
 * @author Sahil Dave [sahil.dave@juspay.in]
 * @author Sri Harsha Chilakapati [sri.harsha@juspay.in]
 * @author Dayanidhi D [dayanidhi.d@juspay.in]
 * @since 14/03/2017
 */
public class FileProviderService {

    private static final String LOG_TAG = "FileProviderService";
    @NonNull
    private final Map<String, String> fileCache = new HashMap<>();
    @NonNull
    private final List<String> fileCacheWhiteList = new ArrayList<>();
    private final boolean shouldCheckInternalAssets = true;
    final HyperFileUtil hyperFileUtil;

    @NonNull
    private final OTAServices otaServices;

    public FileProviderService(@NonNull OTAServices otaServices) {
        this.otaServices = otaServices;
        this.hyperFileUtil = new HyperFileUtil(otaServices.getCleanUpValue(),
                new FileUtilCallback() {

                    @Override
                    public boolean copyFile(@NotNull File from, @NotNull File to) {
                        return FileProviderService.this.copyFile(from, to);
                    }

                    @Override
                    @NotNull
                    public InputStream getAssetFileAsInputStream(@NotNull String fileName) throws IOException {
                        return openAsset(fileName);
                    }

                    @Override
                    @NonNull
                    public byte[] getFileInAssets(@NotNull String fileName) throws RuntimeException {
                        return getAssetFileAsByte(fileName);
                    }

                    @NonNull
                    @Override
                    public File getFileInInternalStorage(@NotNull String fileName) {
                        return getFileFromInternalStorageInternal(fileName);
                    }

                    @NonNull
                    @Override
                    public byte[] readFileFromInternalStorage(@NotNull String fileName) throws FileNotFoundException, RuntimeException {
                        return getInternalStorageFileAsByte(fileName);
                    }

                    @Override
                    public boolean deleteFile(@NotNull File fileToDelete) {
                        return FileProviderService.this.deleteFile(fileToDelete);
                    }

                    @NonNull
                    @Override
                    public JSONObject getMetadata(@NotNull String fileName) throws JSONException {
                        return otaServices.getRemoteAssetService().getMetadata(fileName);
                    }

                    public void resetMetadata(@NonNull String fileName) {
                        try {
                            otaServices.getRemoteAssetService().resetMetadata(fileName);
                        } catch (JSONException e) {
                            otaServices.getTrackerCallback().trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Couldn't reset metadata for file name " + fileName, e);
                        }
                    }
                }, new in.juspay.hyperutil.TrackerCallback() {
            @Override
            public void track(@NotNull String category, @NotNull String subCategory, @NotNull String level, @NotNull String label, @NotNull String key, @NotNull JSONObject value) {
                otaServices.getTrackerCallback().track(category, subCategory, level, label, key, value);
            }

            @Override
            public void trackException(@NotNull String category, @NotNull String subCategory, @NotNull String label, @NotNull String description, @NotNull Throwable e) {
                otaServices.getTrackerCallback().trackException(category, subCategory, label, description, e);
            }

            @Override
            public void trackAndLogException(@NotNull String tag, @NotNull String category, @NotNull String subCategory, @NotNull String label, @NotNull String description, @NotNull Throwable e) {
                otaServices.getTrackerCallback().trackAndLogException(tag, category, subCategory, label, description, e);
            }

        });
    }

    public HyperFileUtil getHyperFileUtil() {
        return hyperFileUtil;
    }

    public void addToFileCacheWhiteList(String fileName) {
        fileCacheWhiteList.add(fileName);
    }

    @NonNull
    public String readFromFile(@NonNull String fileName) {
        return readFromFile(fileName, true);
    }

    public String readFromFile(String fileName, boolean useCache) {
        String data = null;
        if (useCache) {
            data = readFromCache(fileName);
        }

        if (data == null && !otaServices.getFromAirborne()) {
            data = hyperFileUtil.readFileForHyperSDK(fileName);
        } else if (data == null) {
            if (shouldCheckInternalAssets) {
                data = readFromInternalStorage(fileName);
            }

            if (data == null) {
                data = readFromAssets(fileName);
            }
        }

        if (fileCacheWhiteList.contains(fileName) && data != null) {
            cacheFile(fileName, data);
        }

        return data == null ? "" : data;
    }

    public String readFromCache(String fileName) {
        if (isFileCached(fileName)) {
            final String returnData = fileCache.get(fileName);

            Log.d(LOG_TAG, "Returning cached value of the file: " + fileName);
            Log.d(LOG_TAG, "Cached: " + returnData);

            return returnData;
        }

        return null;
    }

    public String readFromInternalStorage(String fileName) {

        if (otaServices.getUseBundledAssets()) {
            return null;
        }

        if (!otaServices.getFromAirborne()) {
            String result = hyperFileUtil.readFileFromInternalStorage(fileName);
            return result != null ? result : "";
        }
        try {
            String content = new String(getInternalStorageFileAsByte(fileName));
            otaServices.getTrackerCallback().track(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, LogLevel.DEBUG, Labels.System.FILE_PROVIDER_SERVICE, "readFromInternalStorage", new JSONObject().put("Returning the file content for file ", fileName));
            if (fileName.endsWith(".json")) {
                try {
                    new JSONObject(content);
                } catch (JSONException e) {
                    deleteAndRemoveMetadata(fileName);
                    return null;
                }
            }
            return content;
        } catch (Exception e) {
            otaServices.getTrackerCallback().trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "read from internal storage failed", e);
        }

        return null;
    }

    public String readFromAssets(String fileName) {
        final TrackerCallback tracker = otaServices.getTrackerCallback();

        try {
            byte[] encrypted = getAssetFileAsByte(fileName);
            return new String(encrypted);
        } catch (Exception e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Exception trying to read file from assets: " + fileName, e);
            return null;
        }
    }

    private void cacheFile(String fileName, String fromInternalStorage) {
        fileCache.put(fileName, fromInternalStorage);
        Log.d(LOG_TAG, "Caching file: " + fileName);
    }

    private boolean isFileCached(String fileName) {
        return fileCache.containsKey(fileName);
    }

    @SuppressWarnings("UnusedReturnValue")
    public boolean updateFile(@NonNull Context context, String fileName, byte[] content) {
        return writeToFileAtomic(context, fileName, content, false);
    }

    public boolean updateFile(String fileName, byte[] content) {
        return writeToFileAtomic(Workspace.getCtx(), fileName, content, false);
    }

    @SuppressWarnings("UnusedReturnValue")
    public boolean updateCertificate(@NonNull Context context, String fileName, byte[] content) {
        return writeToFileAtomic(context, fileName, content, true);
    }

    boolean copyFile(File from, File to) {
        try {
            Log.d(LOG_TAG, "copyFile: " + from.getAbsolutePath() + "   " + to.getAbsolutePath());

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    Files.copy(from.toPath(), to.toPath(), StandardCopyOption.REPLACE_EXISTING);
                    return true;
                } catch (Exception e) {
                    otaServices.getTrackerCallback().trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Files.copy failed: " + from.getName(), e);
                }
            }

            try (InputStream in = new FileInputStream(from)) {
                try (OutputStream out = new FileOutputStream(to)) {
                    byte[] buffer = new byte[1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                    }
                    // write the output file (You have now copied the file)
                    out.flush();
                }
            }
            return true;
        } catch (FileNotFoundException e) {
            otaServices.getTrackerCallback().trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "File not found: " + from.getName(), e);
            return false;
        } catch (Exception e) {
            otaServices.getTrackerCallback().trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Exception: " + from.getName(), e);
            return false;
        }
    }

    private boolean writeToFileAtomic(@NonNull Context context, String realFileName, byte[] content, boolean isCertificate) {
        deleteFileFromCache(realFileName);
        return writeToFile(getFileFromInternalStorageInternal(realFileName), content, isCertificate, true);
    }

    // This write file takes care of atomicity by writing the file to a temp file and then renaming that to the original file name.
    public boolean writeToFile(File file, byte[] content, boolean isCertificate, boolean writeAtomic) {

        final TrackerCallback tracker = otaServices.getTrackerCallback();
        try {

            String decodedFileName = file.getName();
            if (!isCertificate && !otaServices.getFromAirborne()) {
                HyperFileUtil.DecodeFileResponse decodeResponse = hyperFileUtil.decodeFileContent(file.getName(), content);
                decodedFileName = decodeResponse.getFileName();
                content = decodeResponse.getContent();
            }

            File tempFile = new File(file.getParentFile(), writeAtomic ? "temp_" + decodedFileName : decodedFileName);
            try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                fos.write(content);
                if (!writeAtomic) {
                    return true;
                }
                return tempFile.renameTo(new File(file.getParentFile(), decodedFileName));
            } catch (Exception e) {
                tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Exception writing decrypted js file " + decodedFileName, e);
            }
        } catch (FileNotFoundException e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "File not found: " + file.getName(), e);
        } catch (IOException e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "IOException: " + file.getName(), e);
        } catch (Exception e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Exception: " + file.getName(), e);
        }

        return false;
    }

    private InputStream openAsset(String fileName) throws IOException {
        return otaServices.getWorkspace().openAsset(fileName);
    }

    public boolean isFilePresent(@NonNull Context context, String fileName) {

        if (!otaServices.getFromAirborne()) {
            return hyperFileUtil.isFilePresent(fileName);
        }

        File file = otaServices.getWorkspace().open(fileName);
        if (file.exists()) {
            return true;
        }

        try (InputStream is = openAsset(fileName)) {
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    public File getFileFromInternalStorage(String fileName) {

        Log.d(LOG_TAG, "Getting file from internal storage. Filename: " + fileName);

        if (!otaServices.getFromAirborne()) {
            return hyperFileUtil.getFileFromInternalStorage(fileName);
        }

        return getFileFromInternalStorageInternal(fileName);
    }

    public File getFileFromInternalStorageInternal(String fileName) {

        Log.d(LOG_TAG, "Getting file from internal storage. Filename: " + fileName);

        final File file = otaServices.getWorkspace().open(fileName);
        final File parent = file.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }

        return file;
    }

    public byte[] getInternalStorageFileAsByte(String fileName) throws FileNotFoundException, RuntimeException {
        final TrackerCallback tracker = otaServices.getTrackerCallback();
        final RemoteAssetService remoteAssetService = otaServices.getRemoteAssetService();

        try {
            try (ByteArrayOutputStream ous = new ByteArrayOutputStream()) {
                try (InputStream ios = new FileInputStream(getFileFromInternalStorageInternal(fileName))) {
                    readFromInputStream(ous, ios);
                }
                return ous.toByteArray();
            }
        } catch (FileNotFoundException e) {
            Log.d(LOG_TAG, "File not found " + fileName);

            try {
                remoteAssetService.resetMetadata(fileName);
            } catch (JSONException e1) {
                tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Couldn't reset " + fileName, e);
            }

            throw e;
        } catch (IOException e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Could not read " + fileName, e);
            deleteFileFromInternalStorage(fileName);

            throw new RuntimeException(e);
        } catch (Exception e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Exception: Could not read " + fileName, e);
            deleteFileFromInternalStorage(fileName);

            throw new RuntimeException(e);
        }
    }

    public byte[] getAssetFileAsByte(String fileName) {
        final TrackerCallback tracker = otaServices.getTrackerCallback();

        try {
            try (ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                try (InputStream is = openAsset(fileName)) {
                    readFromInputStream(bos, is);
                }
                return bos.toByteArray();
            }
        } catch (IOException e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Could not read " + fileName, e);
            throw new RuntimeException(e);
        } catch (Exception e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Exception: Could not read " + fileName, e);
        }

        return new byte[]{};
    }

    private void readFromInputStream(ByteArrayOutputStream bos, InputStream is) throws IOException {
        byte[] buffer = new byte[4096];
        int read;

        while ((read = is.read(buffer)) != -1) {
            bos.write(buffer, 0, read);
        }
    }

    @SuppressWarnings("UnusedReturnValue")
    public boolean deleteFileFromInternalStorage(String fileName) {

        if (!otaServices.getFromAirborne()) {
            return hyperFileUtil.deleteFileFromInternalStorage(fileName);
        } else {
            final TrackerCallback tracker = otaServices.getTrackerCallback();
            final RemoteAssetService remoteAssetService = otaServices.getRemoteAssetService();
            File fileToDelete = getFileFromInternalStorageInternal(fileName);
            if (fileToDelete.exists()) {
                Log.d(LOG_TAG, "Deleting " + fileName + " from internal storage");
                try {
                    tracker.track(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, LogLevel.WARNING, Labels.System.FILE_PROVIDER_SERVICE, "file_deleted", new JSONObject().put("Deleted file", fileName));
                    remoteAssetService.resetMetadata(fileName);
                } catch (Exception e) {
                    tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Error while resetting etag", e);
                }

                return deleteFile(fileToDelete);
            } else {
                Log.e(LOG_TAG, fileName + " not found");
                return false;
            }
        }
    }

    private boolean deleteFile(File fileToDelete) {
        try {
            return fileToDelete.isDirectory() ? OTAUtils.deleteRecursive(fileToDelete) : fileToDelete.delete();
        } catch (Exception e) {
            otaServices.getTrackerCallback().trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Error while deleting file " + fileToDelete.getAbsolutePath(), e);
        }
        return false;
    }

    @Nullable
    public String[] listFilesRecursive(String dirPath) {
        File dir = otaServices.getWorkspace().open(dirPath);
        return listAllFilesRecursively("", dir).toArray(new String[0]);
    }

    @Nullable
    public String[] listFilesRecursive(File dir) {
        return listAllFilesRecursively("", dir).toArray(new String[0]);
    }

    Set<String> listAllFilesRecursively(String prefix, File dir) {
        Set<String> files = new HashSet<>();
        if (dir == null || !dir.exists()) {
            return files;
        }

        File[] entries = dir.listFiles();
        if (entries != null) {
            for (File entry : entries) {
                if (entry.isDirectory()) {
                    files.addAll(listAllFilesRecursively(prefix + entry.getName() + "/", entry));
                } else {
                    if (!otaServices.getFromAirborne()) {
                        files.add(prefix + hyperFileUtil.encodeFileName(entry.getName()));
                    } else {
                        files.add(prefix + entry.getName());
                    }
                }
            }
        }

        return files;
    }

    private void deleteFileFromCache(String fileName) {
        if (isFileCached(fileName)) {
            fileCache.remove(fileName);
        }
    }

    public String writeFileToDisk(@NonNull Context context, String data, String fileName) {
        try {
            File externalFilesDir = context.getExternalFilesDirs(Environment.DIRECTORY_DOWNLOADS)[0];
            File path = new File(externalFilesDir.getAbsolutePath());

            //noinspection ResultOfMethodCallIgnored
            path.mkdirs();
            File file = new File(path, fileName);
            //noinspection ResultOfMethodCallIgnored
            file.createNewFile();
            if (file.exists()) {
                FileWriter fileWriter = new FileWriter(file);
                fileWriter.write(data);
                fileWriter.flush();
                fileWriter.close();
                JSONObject respData = new JSONObject();
                respData.put("error", "false");
                respData.put("data", path);
                return respData.toString();
            } else {
                String error = "Exception in creating the file";
                Log.d(LOG_TAG, error);
                return String.format("{\"error\":\"true\",\"data\":\"%s\"}", "unknown_error::" + error);
            }
        } catch (Exception e) {
            Log.d(LOG_TAG, "Exception in downloading the file :" + e);
            return String.format("{\"error\":\"true\",\"data\":\"%s\"}", "unknown_error::" + e);
        }
    }

    private void deleteAndRemoveMetadata(String fileName) {
        try {
            getFileFromInternalStorageInternal(fileName).delete();
            otaServices.getRemoteAssetService().resetMetadata(fileName);
        } catch (Exception ignore) {
        }
    }

    public TempWriter newTempWriter(String label) {
        try {
            return new TempWriter(label, Mode.NEW, otaServices);
        } catch (Exception e) {
            // Un-reachable code.
            throw new RuntimeException(e);
        }
    }

    public TempWriter reOpenTempWriter(String name) throws FileNotFoundException {
        return new TempWriter(name, Mode.RE_OPEN, otaServices);
    }

    enum Mode {
        NEW,
        RE_OPEN
    }
}
