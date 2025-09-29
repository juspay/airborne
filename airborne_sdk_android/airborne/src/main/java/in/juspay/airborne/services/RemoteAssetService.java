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

import static in.juspay.airborne.constants.OTAConstants.ATTR_HASH_IN_DISK;
import static in.juspay.airborne.services.ServiceConstants.ASSET_METADATA_FILE_NAME;
import static in.juspay.airborne.services.ServiceConstants.ATTR_LAST_CHECKED;
import static in.juspay.airborne.services.ServiceConstants.ATTR_ZIPHASH_IN_DISK;

import android.content.Context;
import android.os.AsyncTask;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import in.juspay.airborne.TrackerCallback;
import in.juspay.airborne.network.OTANetUtils;
import in.juspay.airborne.utils.OTAUtils;
import in.juspay.airborne.constants.Labels;
import in.juspay.airborne.constants.LogCategory;
import in.juspay.airborne.constants.LogLevel;
import in.juspay.airborne.constants.LogSubCategory;

/**
 * Utility functions that deal with downloading of hot-pushed assets.
 * <p>
 * <em>This file contains the critical functions that are
 * required by the Juspay SDKs to run, and care has to be taken to modify. Please stop if you do not know where you are
 * going.</em>
 *
 * @author Veera Manohara Subbiah [veera.subbiah@juspay.in]
 * @author Sri Harsha Chilakapati [sri.harsha@juspay.in]
 * @since 26/04/2017
 */
public class RemoteAssetService {
    private static final String LOG_TAG = "RemoteAssetService";

    private JSONObject assetMetadata;
    private static final JSONArray fileDownloadTimes = new JSONArray();

    @NonNull
    private final OTAServices otaServices;

    public RemoteAssetService(@NonNull OTAServices otaServices) {
        this.otaServices = otaServices;
    }

    private long getAssetTtl() {
        return Long.parseLong(otaServices.getWorkspace().getFromSharedPreference(ServiceConstants.KEY_REMOTE_ASSET_TTL, String.valueOf(ServiceConstants.DEF_REMOTE_ASSET_TTL)));
    }

    public boolean getContent(@NonNull Context context, String location) throws Exception {
        return getContent(context, location, getAssetTtl());
    }

    private byte[] download(String sourceHash, String location) {
        //HTTP GET to download latest Copy
        HashMap<String, String> queryParam = new HashMap<>();

        queryParam.put("ts", String.valueOf(System.currentTimeMillis()));
        queryParam.put("If-None-Match", sourceHash);
        queryParam.put("Accept-Encoding", "gzip");

        Log.d(LOG_TAG, "START fetching content from: " + location);

        byte[] newText = null;

        try {
            // TODO Have to send clientId, merchantId
            String clientId = otaServices.getClientId();
            if (clientId == null) {
                clientId = "";
            }
            OTANetUtils netUtils = new OTANetUtils(Workspace.getCtx(), clientId, otaServices.getCleanUpValue());
            newText = netUtils.fetchIfModified(location, queryParam);
        } catch (Exception e) {
            otaServices.getTrackerCallback().trackAndLogException(LOG_TAG, LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.REMOTE_ASSET_SERVICE, "Error While Downloading File", e);
        }

        return newText;
    }

    private String decideAndUpdateInternalStorage(@NonNull Context context, byte[] newText, String sourceHash, String fileName) {
        boolean isFileUpdated = false;

        String newHash = OTAUtils.md5(newText);

        if (newHash == null) {
            newHash = "";
        }

        Log.d(LOG_TAG, "hashInDisk: " + sourceHash);
        Log.d(LOG_TAG, "newHash: " + newHash);

        final TrackerCallback trackerCallback = otaServices.getTrackerCallback();
        try {
            if (sourceHash != null && sourceHash.equals(newHash)) {
                trackerCallback.track(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, LogLevel.INFO, Labels.System.REMOTE_ASSET_SERVICE, "remote_asset_service_compare_hash", new JSONObject().put("Remote hash is same as disk hash. Not updating asset", fileName));
            } else {
                trackerCallback.track(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, LogLevel.INFO, Labels.System.REMOTE_ASSET_SERVICE, "remote_asset_service_compare_hash", new JSONObject().put("Remote hash differs from disk hash. Updating asset", fileName));
                isFileUpdated = otaServices.getFileProviderService().updateFile(context, fileName, newText);
            }
        } catch (Exception ignore) {
        }

        return isFileUpdated ? newHash : null;
    }

    private String unzipAndUpdateInternalStorage(@NonNull Context context, byte[] certificates) throws IOException {
        //Open Stream to unzip downloaded bytes
        String newHash = OTAUtils.md5(certificates);

        if (newHash == null) {
            newHash = "";
        }

        try (ZipInputStream zin = new ZipInputStream(new ByteArrayInputStream(certificates))) {
            ZipEntry distinctFiles;
            while ((distinctFiles = zin.getNextEntry()) != null) {
                String unzippedFileName = distinctFiles.getName();
                if (distinctFiles.isDirectory()) {
                    continue;
                }

                try (ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    for (int c = zin.read(); c != -1; c = zin.read()) {
                        buffer.write(c);
                    }
                    otaServices.getFileProviderService().updateCertificate(context, unzippedFileName, buffer.toByteArray());
                }
            }
        }
        return newHash;
    }

    private boolean getContent(@NonNull Context context, String location, long ttl) throws Exception {
        return getContent(context, location, null, ttl);
    }

    private boolean getContent(@NonNull Context context, String location, String fileName, long ttl) throws Exception {
        final FileProviderService fileProviderService = otaServices.getFileProviderService();
        final TrackerCallback trackerCallback = otaServices.getTrackerCallback();

        int index = location.lastIndexOf("/");
        if (fileName == null) {
            fileName = location.substring(index + 1);
        }

        JSONObject assetMetadata = !otaServices.getFromAirborne() ? fileProviderService.hyperFileUtil.getMetadata(fileName) : getMetadata(fileName);
        String sourceHash = "", zipHash = "";

        if (null != assetMetadata.getString(ATTR_LAST_CHECKED)) {
            sourceHash = assetMetadata.getString(ATTR_HASH_IN_DISK);
            zipHash = assetMetadata.getString(ATTR_ZIPHASH_IN_DISK);
        } else {
            sourceHash = fileProviderService.readFromFile(fileName + ".hash");
        }

        byte[] newText = download(zipHash, location);
        if (newText != null) {
            zipHash = OTAUtils.md5(newText);
        }
        newText = !otaServices.getFromAirborne() ? fileProviderService.hyperFileUtil.verifyFileForHyperSDK(newText, fileName) : newText;
        if (newText == null) {
            trackerCallback.track(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, LogLevel.INFO, Labels.System.REMOTE_ASSET_SERVICE, "remote_asset_service_etag_match", new JSONObject().put("ETAG matched for file", fileName).put("Not downloading from", location));
            return false;
        }
        Log.d(LOG_TAG, "DONE fetching content from: " + location);
        Log.d(LOG_TAG, "Text: " + new String(newText));

        String newHash = decideAndUpdateInternalStorage(context, newText, sourceHash, fileName);
        if (newHash != null) {
            fileProviderService.writeFileToDisk(context, newHash, fileName + ".hash");
            assetMetadata.put(ATTR_LAST_CHECKED, System.currentTimeMillis());
            assetMetadata.put(ATTR_HASH_IN_DISK, newHash);
            assetMetadata.put(ATTR_ZIPHASH_IN_DISK, zipHash);
            setMetadata(fileProviderService.hyperFileUtil.getFileNameForMetadata(fileName), assetMetadata);
        }
        return true;
    }

    public void renewFile(@NonNull Context context, final String location, final String fileName, final long startTime, final DownloadCallback downloadCallback) {
        renewFile(context, location, getAssetTtl(), fileName, startTime, downloadCallback);
    }

    public void renewFile(@NonNull Context context, final String location, final long startTime, DownloadCallback downloadCallback) {
        renewFile(context, location, getAssetTtl(), null, startTime, downloadCallback);
    }

    public void renewFile(@NonNull Context context, final String location, final long ttlInMilliSeconds, final String fileName, final long startTime, @Nullable final DownloadCallback downloadCallback) {
        Log.d(LOG_TAG, "Looking to renew file: " + location);
        new AssetDownloadTask(context, location, fileName, ttlInMilliSeconds, this, startTime, downloadCallback).executeOnExecutor(AsyncTask.THREAD_POOL_EXECUTOR);
    }

    private void updateCertificates(@NonNull Context context, String location, long ttl) throws JSONException, IOException {
        final TrackerCallback trackerCallback = otaServices.getTrackerCallback();
        final FileProviderService fileProviderService = otaServices.getFileProviderService();

        JSONObject assetMetadata = getMetadata(location);
        int index = location.lastIndexOf("/");
        String fileName = location.substring(index + 1);
        String sourceHash = "";
        String newHash = "";
        String zipHash = "";
        boolean fileModified = false;

        if (null != assetMetadata.getString(ATTR_LAST_CHECKED)) {
            sourceHash = assetMetadata.getString(ATTR_HASH_IN_DISK);
            zipHash = assetMetadata.getString(ATTR_ZIPHASH_IN_DISK);
        }

        byte[] certificates = download(zipHash, location);
        if (certificates != null) {
            fileModified = true;
            zipHash = OTAUtils.md5(certificates);
        }

        certificates = !otaServices.getFromAirborne() ? fileProviderService.hyperFileUtil.verifyFileForHyperSDK(certificates, fileName) : certificates;

        Log.d(LOG_TAG, "DONE fetching content from: " + location);
        Log.d(LOG_TAG, "hashInDisk: " + sourceHash);
        Log.d(LOG_TAG, "newHash: " + newHash);

        trackerCallback.track(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, LogLevel.INFO, Labels.System.REMOTE_ASSET_SERVICE, "remote_asset_service_update_hash", new JSONObject().put("Hash of file in disk", fileName).put("new hash", newHash));

        if (certificates == null) {
            if (!fileModified) {
                trackerCallback.track(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, LogLevel.INFO, Labels.System.REMOTE_ASSET_SERVICE, "remote_asset_service_etag_match", new JSONObject().put("ETAG matched for", fileName).put("Not downloading from", location));
            }
        } else {
            newHash = unzipAndUpdateInternalStorage(context, certificates);
            assetMetadata.put(ATTR_LAST_CHECKED, System.currentTimeMillis());
            assetMetadata.put(ATTR_HASH_IN_DISK, newHash);
            assetMetadata.put(ATTR_ZIPHASH_IN_DISK, zipHash);
            setMetadata(location, assetMetadata);
        }
    }

    public synchronized JSONObject getMetadata(String location) throws JSONException {
        final TrackerCallback trackerCallback = otaServices.getTrackerCallback();
        try {
            assetMetadata = new JSONObject(otaServices.getWorkspace().getFromSharedPreference(ASSET_METADATA_FILE_NAME, "{}"));
        } catch (JSONException e) {
            trackerCallback.trackAndLogException(LOG_TAG, LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.REMOTE_ASSET_SERVICE, "Exception trying to read from KeyStore: " + ASSET_METADATA_FILE_NAME, e);
            throw new RuntimeException("Unexpected internal error.", e);
        }

        Log.d(LOG_TAG, "assetMetadata: " + assetMetadata);

        if (!assetMetadata.has(location)) {
            assetMetadata.put(location, new JSONObject());
            ((JSONObject) assetMetadata.get(location)).put(ATTR_LAST_CHECKED, 0);
            ((JSONObject) assetMetadata.get(location)).put(ATTR_HASH_IN_DISK, "");
            ((JSONObject) assetMetadata.get(location)).put(ATTR_ZIPHASH_IN_DISK, "");
        }

        return (JSONObject) assetMetadata.get(location);
    }

    private synchronized void setMetadata(String location, JSONObject assetMetadata) throws JSONException {
        if (this.assetMetadata == null) {
            getMetadata(location);
        }

        this.assetMetadata.put(location, assetMetadata);

        otaServices.getWorkspace().writeToSharedPreference(ASSET_METADATA_FILE_NAME, this.assetMetadata.toString());
    }

    public synchronized void resetMetadata(String location) throws JSONException {
        if (assetMetadata == null) {
            getMetadata(location);
        }

        assetMetadata.remove(location);
        otaServices.getWorkspace().writeToSharedPreference(ASSET_METADATA_FILE_NAME, assetMetadata.toString());
    }

    /**
     * Class for the async task that downloads assets from the server.
     *
     * @author Sri Harsha Chilakapati [sri.harsha@juspay.in]
     * @since 09/12/2019
     */
    private static class AssetDownloadTask extends AsyncTask<Void, Void, Boolean> {
        private final String location;
        private final String fileName;
        private final long ttlInMilliSeconds;
        private final WeakReference<Context> contextWeakReference;
        private final long renewFileStartTime;
        private final RemoteAssetService remoteAssetService;
        @Nullable
        private final DownloadCallback downloadCallback;

        AssetDownloadTask(@NonNull Context context, String location, String fileName, long ttlInMilliSeconds, RemoteAssetService remoteAssetService, long time, @Nullable DownloadCallback downloadCallback) {
            this.location = location;
            this.fileName = fileName;
            this.ttlInMilliSeconds = ttlInMilliSeconds;
            this.remoteAssetService = remoteAssetService;
            this.contextWeakReference = new WeakReference<>(context);
            this.renewFileStartTime = time;
            this.downloadCallback = downloadCallback;
        }

        @Override
        protected Boolean doInBackground(Void... voids) {
            Context context = contextWeakReference.get();
            if (context != null) {
                try {
                    if (!location.contains("certificates")) {
                        return remoteAssetService.getContent(context, location, fileName, ttlInMilliSeconds);
                    } else {
                        remoteAssetService.updateCertificates(context, location, ttlInMilliSeconds);
                    }
                } catch (Exception e) {
                    remoteAssetService.otaServices
                            .getTrackerCallback()
                            .trackAndLogException(LOG_TAG, LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.REMOTE_ASSET_SERVICE, "Could not renew file " + location + ": " + e.getMessage(), e);
                }
            }

            return false;
        }

        @Override
        protected void onPostExecute(Boolean downloaded) {
            super.onPostExecute(downloaded);

            long renewFileEndTime = System.currentTimeMillis();
            long totalFileDownloadTime = renewFileEndTime - this.renewFileStartTime;
            JSONObject fileDownLoadTimeObj = new JSONObject();
            try {
                fileDownLoadTimeObj.put("startTime", renewFileStartTime);
                fileDownLoadTimeObj.put("endTime", renewFileEndTime);
                fileDownLoadTimeObj.put("totalTime", totalFileDownloadTime);
                fileDownLoadTimeObj.put("fileName", this.fileName);
            } catch (JSONException ignored) {
            }
            fileDownloadTimes.put(fileDownLoadTimeObj);
            if (downloadCallback != null) {
                downloadCallback.onDownload(downloaded, location, remoteAssetService.otaServices.getFileProviderService().hyperFileUtil.appendSdkNameAndVersion(fileName));
            }
        }
    }

    public JSONArray getFileDownloadTimes() {
        return fileDownloadTimes;
    }

    public interface DownloadCallback {
        void onDownload(boolean didDownload, String location, String fileSavedAs);
    }
}
