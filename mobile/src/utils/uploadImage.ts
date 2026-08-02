import axios from 'axios';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../config/cloudinary';

export async function uploadToCloudinary(uri: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'image/jpeg',
    name: `txn_${Date.now()}.jpg`,
  } as any);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data.secure_url as string;
}
