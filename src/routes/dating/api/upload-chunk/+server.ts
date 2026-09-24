// PURPOSE: Keep Dating audio transcription inside the Dating route and ContextSpace boundary.
// SECURITY: The shared handler binds every temporary upload and transcript job to locals.user and locals.contextSpaceId.

export { POST } from '../../../api/upload-chunk/+server';
