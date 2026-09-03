import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Share } from "@capacitor/share";
import { isNative } from "./platform";
import { requestPermission } from "./permissions";

export async function takePhoto(): Promise<{ dataUrl: string } | null> {
  const perm = await requestPermission("camera");
  if (perm !== "granted" && isNative()) {
    throw new Error("Camera permission is required");
  }

  if (!isNative()) {
    // Web fallback: file input should be used by caller
    return null;
  }

  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    correctOrientation: true,
  });

  if (!photo.dataUrl) return null;
  return { dataUrl: photo.dataUrl };
}

export async function pickFromGallery(): Promise<{ dataUrl: string } | null> {
  if (!isNative()) return null;

  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Photos,
    correctOrientation: true,
  });

  if (!photo.dataUrl) return null;
  return { dataUrl: photo.dataUrl };
}

export async function shareText(title: string, text: string, url?: string) {
  await Share.share({ title, text, url, dialogTitle: title });
}
