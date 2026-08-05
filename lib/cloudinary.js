
export const CLOUDINARY_CLOUD_NAME = 'vhd33d2f';
export const CLOUDINARY_UPLOAD_PRESET = 'fitindia_uploads';


export async function uploadImageToCloudinary(localUri) {
  if (CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME') {
    throw new Error('Cloudinary is not configured yet — fill in CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in lib/cloudinary.js.');
  }

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    type: 'image/jpeg',
    name: 'gym-photo.jpg',
  });
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Photo upload failed.');
  }
  return data.secure_url;
}


export async function uploadBase64ToCloudinary(base64DataUri) {
  if (CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME') {
    throw new Error('Cloudinary is not configured yet — fill in CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in lib/cloudinary.js.');
  }

  const formData = new FormData();
  formData.append('file', base64DataUri);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Signature upload failed.');
  }
  return data.secure_url;
}
