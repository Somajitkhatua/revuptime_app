import { Platform } from "react-native";
import { File } from "expo-file-system";
import { client, isDemo } from "./supabase";
import { uuid } from "./demo";
import { UploadFile } from "./documents";
export async function getAvatar(user: string) {
  const { data, error } = await client()
    .from("profiles")
    .select("avatar_path")
    .eq("id", user)
    .maybeSingle();
  if (error) throw error;
  if (!data?.avatar_path) return {};
  const signed = await client()
    .storage.from("profile-photos")
    .createSignedUrl(data.avatar_path, 3600);
  return { avatar_path: data.avatar_path, avatar_url: signed.data?.signedUrl };
}
export async function uploadAvatar(file: UploadFile) {
  if (isDemo)
    throw new Error("Sign in to your account to save a profile photo.");
  const { data, error } = await client().auth.getUser();
  if (error || !data.user?.email_confirmed_at)
    throw new Error("Sign in with a verified account to update your photo.");
  const mime = file.mimeType || "image/jpeg";
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ].includes(mime)
  )
    throw new Error("Choose a JPEG, PNG, WebP or HEIC photo.");
  if ((file.size || 0) > 5 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 5 MB.");
  const bytes =
    Platform.OS === "web"
      ? await (
          file.file || (await (await fetch(file.uri)).blob())
        ).arrayBuffer()
      : await new File(file.uri).arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 5 MB.");
  const previous = await client()
    .from("profiles")
    .select("avatar_path")
    .eq("id", data.user.id)
    .single();
  if (previous.error) throw previous.error;
  const path = `${data.user.id}/${uuid()}.${mime.split("/")[1]}`;
  const uploaded = await client()
    .storage.from("profile-photos")
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (uploaded.error) throw uploaded.error;
  const saved = await client()
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", data.user.id)
    .select("id")
    .single();
  if (saved.error) {
    await client().storage.from("profile-photos").remove([path]);
    throw saved.error;
  }
  const old = previous.data.avatar_path;
  if (old && old !== path && old.startsWith(`${data.user.id}/`))
    await client().storage.from("profile-photos").remove([old]);
}
