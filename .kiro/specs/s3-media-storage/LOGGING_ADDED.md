# S3 Media Storage - Comprehensive Logging Added

## Overview

Comprehensive logging has been added throughout the media storage flow to help diagnose why files aren't being saved to S3 even after configuration. All logs use a consistent prefix format to make filtering easy.

## Log Prefixes

- `[MEDIA-STORAGE]` - Main media save operations
- `[STORAGE-CONFIG]` - Storage configuration retrieval and parsing
- `[S3-DRIVER]` - S3 storage driver operations
- `[LOCAL-DRIVER]` - Local storage driver operations
- `[MESSAGE-LISTENER]` - WhatsApp message handling

## Files Modified

### 1. `backend/src/helpers/saveMediaFile.ts`

**Added logging for:**

- Start of media save operation (with file details)
- Storage configuration retrieval
- Storage configuration details (driver, S3 config, optimization)
- Driver creation
- Buffer conversion (with size)
- Image optimization (before/after sizes)
- File write operation (with driver type and size)
- Success confirmation
- Detailed error logging (with stack trace)

**Key logs to watch:**

```
[MEDIA-STORAGE] Starting media file save operation
[MEDIA-STORAGE] Storage configuration retrieved
[MEDIA-STORAGE] Writing file to storage
[MEDIA-STORAGE] Media file saved successfully
```

### 2. `backend/src/infrastructure/storage/S3StorageDriver.ts`

**Added logging for:**

- S3 driver initialization (with endpoint, bucket, region, credentials check)
- Write operation start (with key, bucket, mimetype)
- PutObjectCommand execution
- Write operation success (with ETag, VersionId)
- Write operation failures (with error code, name, stack)
- Read operation start and completion
- Read operation failures

**Key logs to watch:**

```
[S3-DRIVER] Initializing S3 storage driver
[S3-DRIVER] Starting S3 write operation
[S3-DRIVER] Sending PutObjectCommand to S3
[S3-DRIVER] S3 write operation completed successfully
[S3-DRIVER] S3 write operation failed
```

### 3. `backend/src/infrastructure/storage/LocalStorageDriver.ts`

**Added logging for:**

- Local driver initialization (with public path)
- Write operation start
- Write operation success
- Write operation failures

**Key logs to watch:**

```
[LOCAL-DRIVER] Initializing local storage driver
[LOCAL-DRIVER] Starting local write operation
[LOCAL-DRIVER] Local write operation completed successfully
```

### 4. `backend/src/services/WbotServices/wbotMessageListener.ts`

**Added logging for:**

- When media is received from WhatsApp
- Before saving media files
- After successfully saving media files
- For both main messages and quoted messages
- For both media and thumbnails

**Key logs to watch:**

```
[MESSAGE-LISTENER] Saving received message media
[MESSAGE-LISTENER] Received message media saved
[MESSAGE-LISTENER] Saving quoted message media
```

### 5. `backend/src/services/StorageServices/GetStorageConfigService.ts`

**Added logging for:**

- Configuration retrieval start
- Cache hit/miss
- Database query
- Settings parsing
- S3 configuration details (endpoint, bucket, region, etc.)
- Credential decryption
- Image optimization config
- Final configuration creation

**Key logs to watch:**

```
[STORAGE-CONFIG] Retrieving storage configuration
[STORAGE-CONFIG] Storage configuration retrieved from cache
[STORAGE-CONFIG] Parsed S3 configuration
[STORAGE-CONFIG] S3 configuration decrypted successfully
[STORAGE-CONFIG] Storage configuration created and cached
```

## How to Use These Logs

### 1. Filter by prefix

```bash
# View all storage-related logs
grep "\[MEDIA-STORAGE\]\|\[STORAGE-CONFIG\]\|\[S3-DRIVER\]\|\[LOCAL-DRIVER\]\|\[MESSAGE-LISTENER\]" logs/app.log

# View only S3 operations
grep "\[S3-DRIVER\]" logs/app.log

# View only configuration issues
grep "\[STORAGE-CONFIG\]" logs/app.log
```

### 2. Track a specific file

When a file is received, you'll see a sequence like:

```
[MESSAGE-LISTENER] Saving received message media (ticketId, companyId, mimetype, filename)
[MEDIA-STORAGE] Starting media file save operation (companyId, mediaPath, mimetype)
[STORAGE-CONFIG] Retrieving storage configuration (companyId)
[STORAGE-CONFIG] Storage configuration retrieved (driver, hasS3Config)
[S3-DRIVER] Initializing S3 storage driver (endpoint, bucket, region)
[S3-DRIVER] Starting S3 write operation (key, bucket, mimetype)
[S3-DRIVER] Sending PutObjectCommand to S3 (size)
[S3-DRIVER] S3 write operation completed successfully (etag)
[MEDIA-STORAGE] Media file saved successfully (driver, size)
[MESSAGE-LISTENER] Received message media saved (mediaUrl)
```

### 3. Common Issues to Look For

**Issue: Driver is "local" when it should be "s3"**

- Check `[STORAGE-CONFIG]` logs to see what driver is being retrieved
- Verify the database has `storageDriver` set to "s3" for the company

**Issue: S3 config is missing**

- Look for `hasS3Config: false` in `[STORAGE-CONFIG]` logs
- Check if `storageS3Config` exists in the database

**Issue: Credential decryption fails**

- Look for errors in `[STORAGE-CONFIG] Decrypting S3 secret access key`
- Verify `STORAGE_CREDENTIALS_KEY` environment variable is set

**Issue: S3 write fails**

- Look for `[S3-DRIVER] S3 write operation failed`
- Check the error code (e.g., InvalidAccessKeyId, NoSuchBucket, NetworkError)
- Verify S3 credentials, bucket name, and endpoint are correct

**Issue: Files go to local instead of S3**

- Check if `[LOCAL-DRIVER]` logs appear instead of `[S3-DRIVER]`
- This means the driver selection is choosing local storage

## Testing the Logging

1. **Send a test message with media** to your WhatsApp number
2. **Watch the logs** in real-time:
   ```bash
   tail -f logs/app.log | grep "\[MEDIA-STORAGE\]\|\[STORAGE-CONFIG\]\|\[S3-DRIVER\]\|\[LOCAL-DRIVER\]\|\[MESSAGE-LISTENER\]"
   ```
3. **Analyze the flow** to see where the issue occurs

## Next Steps

After reviewing the logs, you should be able to identify:

1. Is the S3 configuration being retrieved correctly?
2. Is the S3 driver being selected?
3. Is the S3 driver being initialized with correct credentials?
4. Are S3 write operations being attempted?
5. What specific error is occurring during S3 writes?

This will help pinpoint the exact issue preventing files from being saved to S3.
