import Modal from './Modal';

export default function MovieDetailsModal({ movie, onClose }: { movie: any, onClose: () => void }) {
  if (!movie) return null;

  const formatRuntime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <Modal isOpen={!!movie} onClose={onClose} closeOnOutsideClick={true}>
      <h2>{movie.title}</h2>
      <p style={{ margin: '5px 0' }}><strong>Lançamento:</strong> {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</p>
      <p style={{ margin: '5px 0' }}><strong>Duração:</strong> {movie.runtime ? formatRuntime(movie.runtime) : 'N/A'}</p>
      <p style={{ margin: '5px 0' }}><strong>Gêneros:</strong> {movie.genres?.map((g: any) => g.name).join(', ')}</p>
      <p style={{ margin: '5px 0' }}><strong>Nota TMDB:</strong> {movie.vote_average ? `${movie.vote_average.toFixed(1)} / 10` : 'N/A'}</p>
      <p style={{ marginTop: '15px', lineHeight: '1.5' }}><strong>Sinopse:</strong><br/>{movie.overview || 'Nenhuma sinopse disponível para este filme.'}</p>
      
      <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'center' }}>
        <a href={`https://www.themoviedb.org/movie/${movie.id}/watch`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', width: '100%' }}>
          <button className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1.1rem', padding: '12px' }}>
            ▶️ Onde Assistir (JustWatch)
          </button>
        </a>
      </div>
    </Modal>
  );
}