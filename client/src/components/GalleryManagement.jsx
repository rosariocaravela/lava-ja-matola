import React, { useEffect, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { apiRequest } from '../api';

export default function GalleryManagement() {
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState({});
  const [title, setTitle] = useState('');
  const [altText, setAltText] = useState('');
  const [file, setFile] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadPhotos() {
    setPhotos(await apiRequest('/gallery/manage'));
  }

  useEffect(() => {
    apiRequest('/gallery/manage')
      .then(setPhotos)
      .catch(loadError => setError(loadError.message));
  }, []);

  useEffect(() => {
    let active = true;
    const objectUrls = [];
    const token = localStorage.getItem('lavaja_token');

    Promise.all(photos.map(async photo => {
      const response = await fetch(`/api/gallery/manage/${photo.id}/image`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(`Não foi possível pré-visualizar a fotografia ${photo.title}.`);
      const url = URL.createObjectURL(await response.blob());
      objectUrls.push(url);
      return [photo.id, url];
    })).then(entries => {
      if (active) setPreviews(Object.fromEntries(entries));
    }).catch(previewError => {
      if (active) setError(previewError.message);
    });

    return () => {
      active = false;
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [photos]);

  async function handleUpload(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!file) {
      setError('Selecione uma fotografia antes de carregar.');
      return;
    }

    setLoading(true);
    try {
      const query = new URLSearchParams({
        title: title.trim(),
        alt_text: altText.trim(),
        authorized: String(authorized)
      });
      const result = await apiRequest(`/gallery/manage?${query}`, {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': 'application/octet-stream' }
      });
      setMessage(result.message);
      setTitle('');
      setAltText('');
      setFile(null);
      setAuthorized(false);
      event.currentTarget.reset();
      await loadPhotos();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function setPublished(photo, isPublished) {
    setError('');
    setMessage('');
    try {
      const result = await apiRequest(`/gallery/manage/${photo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_published: isPublished })
      });
      setMessage(result.message);
      await loadPhotos();
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  async function removePhoto(photo) {
    if (!window.confirm(`Remover definitivamente a fotografia "${photo.title}"?`)) return;
    setError('');
    try {
      const result = await apiRequest(`/gallery/manage/${photo.id}`, { method: 'DELETE' });
      setMessage(result.message);
      await loadPhotos();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <ImagePlus className="h-5 w-5 text-blue-700" /> Publicar fotografias no site
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            As imagens ficam privadas até serem aprovadas. Aceitamos JPEG, PNG ou WebP até 5 MB.
          </p>
        </div>
        <form onSubmit={handleUpload} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Fotografia
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={event => setFile(event.target.files?.[0] || null)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Título
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              maxLength={100}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Descrição da imagem (texto alternativo)
            <input
              value={altText}
              onChange={event => setAltText(event.target.value)}
              maxLength={200}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={authorized}
              onChange={event => setAuthorized(event.target.checked)}
              required
              className="mt-1"
            />
            <span>Confirmo que tenho autorização para publicar esta imagem e que as pessoas e matrículas identificáveis consentiram com a divulgação pública.</span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {loading ? 'A carregar...' : 'Carregar para aprovação'}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-black text-slate-900">Fotografias e estado de publicação</h3>
        {photos.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Ainda não existem fotografias na galeria.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {photos.map(photo => (
              <article key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                {previews[photo.id] && (
                  <img src={previews[photo.id]} alt={photo.alt_text} className="aspect-[4/3] w-full object-cover" />
                )}
                <div className="space-y-3 p-4">
                  <div>
                    <h4 className="font-bold text-slate-900">{photo.title}</h4>
                    <p className="mt-1 text-xs text-slate-600">{photo.alt_text}</p>
                    <p className={`mt-2 text-xs font-bold ${photo.is_published ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {photo.is_published ? 'Publicada' : 'A aguardar aprovação'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPublished(photo, !photo.is_published)}
                      className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100"
                    >
                      {photo.is_published ? 'Retirar do site' : 'Aprovar e publicar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(photo)}
                      aria-label={`Remover ${photo.title}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
