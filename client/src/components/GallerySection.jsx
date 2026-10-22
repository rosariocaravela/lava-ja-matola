import React, { useEffect, useState } from 'react';
import { Images } from 'lucide-react';
import { apiRequest } from '../api';

export default function GallerySection() {
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/gallery')
      .then(setPhotos)
      .catch(loadError => {
        console.error('Erro ao carregar fotografias públicas:', loadError);
        setError('Não foi possível carregar as fotografias neste momento.');
      });
  }, []);

  if (!photos.length && !error) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-700">
            <Images className="h-3.5 w-3.5" />
            Lava Já em imagens
          </span>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">O nosso trabalho</h2>
          <p className="mt-1 text-sm text-slate-600">Fotografias autorizadas e publicadas pela equipa Lava Já.</p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map(photo => (
            <figure key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <img
                src={`/api/gallery/${photo.id}/image`}
                alt={photo.alt_text}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <figcaption className="p-4 text-sm font-bold text-slate-800">{photo.title}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
