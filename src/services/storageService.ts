import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * Uploads a student ID photo to Firebase Storage.
 * Saves to `students/{safeStudentId}/photo_{timestamp}.{ext}`.
 * If Firebase Storage is unavailable or restricted by security rules,
 * it provides a seamless client-side base64 Data URL fallback so the user is never blocked.
 */
export async function uploadStudentPhoto(studentId: string, file: File): Promise<string> {
  const safeId = encodeURIComponent(studentId.trim());
  const cleanExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `students/${safeId}/photo_${Date.now()}.${cleanExt || 'jpg'}`;

  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type || 'image/jpeg',
      customMetadata: {
        studentId,
        uploadedAt: new Date().toISOString(),
      },
    });
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error) {
    console.warn('Firebase Storage upload encountered an issue, falling back to data URL:', error);
    // Client-side Data URL fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read image as data URL'));
        }
      };
      reader.onerror = () => reject(new Error('File reading error'));
      reader.readAsDataURL(file);
    });
  }
}
