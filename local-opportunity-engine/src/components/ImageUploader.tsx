import { useState, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ImageType, PropertyImage } from '@/lib/types';

interface Props {
  propertyId: string;
  images: PropertyImage[];
  onChange: () => void;
}

const IMAGE_TYPES: ImageType[] = ['exterior', 'backyard', 'aerial', 'other'];

export default function ImageUploader({ propertyId, images, onChange }: Props) {
  const [url, setUrl] = useState('');
  const [imageType, setImageType] = useState<ImageType>('exterior');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attachUrl(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    const { error: insertError } = await supabase
      .from('property_images')
      .insert({ property_id: propertyId, url: url.trim(), image_type: imageType });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setUrl('');
    onChange();
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const path = `${propertyId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('property-images').getPublicUrl(path);
      const { error: insertError } = await supabase
        .from('property_images')
        .insert({ property_id: propertyId, url: publicUrl.publicUrl, image_type: imageType });
      if (insertError) throw insertError;

      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function removeImage(id: string) {
    await supabase.from('property_images').delete().eq('id', id);
    onChange();
  }

  return (
    <div className="image-uploader">
      <div className="image-grid">
        {images.map((img) => (
          <figure key={img.id} className="image-tile">
            <img src={img.url} alt={img.image_type} loading="lazy" />
            <figcaption>
              {img.image_type}
              <button type="button" className="link-button" onClick={() => void removeImage(img.id)}>
                Remove
              </button>
            </figcaption>
          </figure>
        ))}
        {images.length === 0 && <p className="muted">No images attached yet.</p>}
      </div>

      <form className="inline-form" onSubmit={(e) => void attachUrl(e)}>
        <select value={imageType} onChange={(e) => setImageType(e.target.value as ImageType)}>
          {IMAGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="url"
          placeholder="https://example.com/photo.jpg"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="submit">Attach URL</button>
        <label className="file-upload-label">
          {uploading ? 'Uploading…' : 'Or upload a file'}
          <input type="file" accept="image/*" onChange={(e) => void handleFileUpload(e)} disabled={uploading} hidden />
        </label>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
