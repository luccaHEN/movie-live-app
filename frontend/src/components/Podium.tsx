interface PodiumProps {
  ranking: { name: string; count: number }[];
}

export default function Podium({ ranking }: PodiumProps) {
  if (!ranking || ranking.length === 0) return <p style={{ textAlign: 'center', color: '#aaa', marginTop: '20px' }}>Nenhum resgate registrado.</p>;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '10px', marginTop: '30px', marginBottom: '30px', height: '160px', padding: '0 20px' }}>
      {/* 2º Lugar */}
      {ranking[1] && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px', textAlign: 'center' }} title={ranking[1].name}>{ranking[1].name}</span>
          <span style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '5px' }}>{ranking[1].count} resg.</span>
          <div style={{ width: '100%', height: '80px', backgroundColor: '#94a3b8', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', color: '#fff', fontWeight: 'bold', fontSize: '2rem', borderRadius: '8px 8px 0 0', paddingTop: '10px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)' }}>2</div>
        </div>
      )}
      {/* 1º Lugar */}
      {ranking[0] && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1.2, position: 'relative', zIndex: 2 }}>
          <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f59e0b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', textAlign: 'center' }} title={ranking[0].name}>{ranking[0].name}</span>
          <span style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '5px' }}>{ranking[0].count} resg.</span>
          <div style={{ width: '100%', height: '110px', backgroundColor: '#f59e0b', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', color: '#fff', fontWeight: 'bold', fontSize: '2.5rem', borderRadius: '8px 8px 0 0', paddingTop: '10px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)' }}>1</div>
        </div>
      )}
      {/* 3º Lugar */}
      {ranking[2] && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px', textAlign: 'center' }} title={ranking[2].name}>{ranking[2].name}</span>
          <span style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '5px' }}>{ranking[2].count} resg.</span>
          <div style={{ width: '100%', height: '60px', backgroundColor: '#b45309', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', color: '#fff', fontWeight: 'bold', fontSize: '1.8rem', borderRadius: '8px 8px 0 0', paddingTop: '10px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)' }}>3</div>
        </div>
      )}
    </div>
  );
}