import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// Definiert die Struktur eines Spielerobjekts
interface Player {
  id: string;
  name: string;
}

// Definiert die Details, die für jede Runde gespeichert werden
interface RundeDetails {
  options: string[];
  winners: string[];
  losers: string[];
  finalScore: number;
}

// Definiert die Struktur einer Spielrunde
interface Runde {
  id: string;
  scores: Record<string, string>;
  spiel: string;
  details: RundeDetails;
  bockArt: string;
}

type PlayerStatus = 'won' | 'lost' | 'neutral';

interface ModalData {
  options: Set<string>;
  playerStates: Record<string, PlayerStatus>;
}

const gameOptions = {
  'Alten gewinnen': ['Keine 90', 'Keine 60', 'Keine 30', 'schwarz'],
  'Alten verlieren': ['Keine 90 gesagt', 'Keine 60 gesagt', 'Keine 30 gesagt', 'schwarz gesagt'],
  'Ansagen': ['Re', 'Kontra'],
  'Solo': ['Solo verloren'],
  'Sonderpunkte': ['Schäfchen verloren'],
};


const RundeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ModalData) => void;
  players: Player[];
  spielwert: string;
  soloWert: string;
  bockStacks: string[][];
}> = ({ isOpen, onClose, onSave, players, spielwert, soloWert, bockStacks }) => {
  const [modalData, setModalData] = useState<ModalData>({
    options: new Set(),
    playerStates: {},
  });
  
  const [gewinnWert, verlierWert] = useMemo(() => {
    return spielwert.split('/').map(v => v.trim());
  }, [spielwert]);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      const initialPlayerStates: Record<string, PlayerStatus> = {};
      players.forEach(p => {
        initialPlayerStates[p.id] = 'neutral';
      });
      setModalData({
        options: new Set(),
        playerStates: initialPlayerStates,
      });
    }
  }, [isOpen, players]);

  const handleOptionToggle = (option: string) => {
    setModalData(prev => {
      const newOptions = new Set(prev.options);
      
      if (newOptions.has(option)) {
        newOptions.delete(option);
        if (option === 'Solo') {
          newOptions.delete('Solo verloren');
        }
      } else {
        newOptions.add(option);
        // Ensure "gewinnen", "verlieren" and "Solo" are mutually exclusive game types
        if (option === 'Alten gewinnen') {
            newOptions.delete('Alten verlieren');
            newOptions.delete('Solo');
            newOptions.delete('Solo verloren');
        } else if (option === 'Alten verlieren') {
            newOptions.delete('Alten gewinnen');
            newOptions.delete('Solo');
            newOptions.delete('Solo verloren');
        } else if (option === 'Solo') {
            newOptions.delete('Alten gewinnen');
            newOptions.delete('Alten verlieren');
            newOptions.delete('Schäfchen verloren'); // Cannot lose sheep in Solo
        }
      }
      return { ...prev, options: newOptions };
    });
  };

  const handlePlayerClick = (playerId: string) => {
    setModalData(prev => {
      const currentStatus = prev.playerStates[playerId];
      let nextStatus: PlayerStatus = 'lost';
      if (currentStatus === 'lost') nextStatus = 'won';
      if (currentStatus === 'won') nextStatus = 'neutral';
      
      const newPlayerStates = { ...prev.playerStates, [playerId]: nextStatus };
      return { ...prev, playerStates: newPlayerStates };
    });
  };

  const isGameTypeSelected = useMemo(() => {
    const { options } = modalData;
    return options.has('Alten gewinnen') || options.has('Alten verlieren') || options.has('Solo');
  }, [modalData.options]);

  const activePlayersCount = useMemo(() => {
    return Object.values(modalData.playerStates).filter(status => status !== 'neutral').length;
  }, [modalData.playerStates]);
  
  const aktuellerSpielwert = useMemo(() => {
    const { options } = modalData;
    let baseScore = 0;

    if (options.has('Solo')) {
        baseScore = parseFloat(soloWert) || 0;
    } else {
        const [gewinnWertStr, verlierWertStr] = spielwert.split('/');
        const gewinnWert = parseFloat(gewinnWertStr) || 0;
        const verlierWert = parseFloat(verlierWertStr) || 0;

        if (options.has('Alten gewinnen')) {
            baseScore = gewinnWert;
        } else if (options.has('Alten verlieren')) {
            baseScore = verlierWert;
        }
    }

    const nonDoublingOptions = new Set([
      'Alten gewinnen', 'Alten verlieren', 'Solo',
      'Schäfchen verloren'
    ]);
    
    let finalScore = baseScore;
    options.forEach(option => {
        if (!nonDoublingOptions.has(option)) {
            finalScore *= 2;
        }
    });

    if (bockStacks.length > 0) {
        finalScore *= Math.pow(2, bockStacks.length);
    }

    if (options.has('Schäfchen verloren')) {
      const [gewinnWertStr] = spielwert.split('/');
      const schaefchenWert = parseFloat(gewinnWertStr) || 0;
      finalScore += schaefchenWert;
    }
    
    return finalScore / 100;
  }, [modalData.options, spielwert, soloWert, bockStacks]);

  const spielZusammenfassung = useMemo(() => {
    const { options, playerStates } = modalData;
    
    const winners = players.filter(p => playerStates[p.id] === 'won');
    const losers = players.filter(p => playerStates[p.id] === 'lost');
    const winnerNames = winners.map(p => p.name);
    const loserNames = losers.map(p => p.name);

    const isSoloGame = options.has('Solo');
    const isSoloWon = isSoloGame && winners.length === 1 && losers.length > 0;
    const isSoloLost = isSoloGame && losers.length === 1 && winners.length > 0;

    let summary = '';

    if (isSoloWon) {
        const winnerPoints = (aktuellerSpielwert * 3).toFixed(1).replace('.', ',');
        const loserPoints = (-aktuellerSpielwert).toFixed(1).replace('.', ',');
        summary = `Gewinner (${winnerNames.join(', ')}): +${winnerPoints}\nVerlierer: ${loserPoints} p.P.`;
    } else if (isSoloLost) {
        const loserPoints = (-aktuellerSpielwert * 3).toFixed(1).replace('.', ',');
        const winnerPoints = aktuellerSpielwert.toFixed(1).replace('.', ',');
        summary = `Verlierer (${loserNames.join(', ')}): ${loserPoints}\nGewinner: +${winnerPoints} p.P.`;
    } else {
        summary = `Wert: ${aktuellerSpielwert.toFixed(1).replace('.', ',')}`;
        if (winnerNames.length > 0) {
            summary += `\nGewinner: ${winnerNames.join(', ')}`;
        }
        if (loserNames.length > 0) {
            summary += `\nVerlierer: ${loserNames.join(', ')}`;
        }
    }

    if (bockStacks.length > 0) {
      summary += `\n(Bockrunde x${Math.pow(2, bockStacks.length)})`;
    }
    
    return summary;
  }, [modalData, players, aktuellerSpielwert, bockStacks]);


  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content">
        <header className="modal-header">
          <h2 id="modal-title">Neue Runde erfassen</h2>
          <button onClick={onClose} className="close-modal-btn" aria-label="Schließen">×</button>
        </header>
        <div className="modal-body">
          <div className="options-grid">
            {Object.entries(gameOptions).map(([category, opts]) => {
               let buttonText = category;
               if (category === 'Alten gewinnen') {
                   buttonText = `Alten gewinnen (${gewinnWert || '?'})`;
               } else if (category === 'Alten verlieren') {
                   buttonText = `Alten verlieren (${verlierWert || '?'})`;
               } else if (category === 'Solo') {
                   buttonText = `Solo (${soloWert || '?'})`;
               }
              
              const isCategoryButton = ['Alten gewinnen', 'Alten verlieren', 'Solo'].includes(category);
              
              return (
              <div key={category} className="options-column">
                {isCategoryButton ? (
                   <button
                    onClick={() => handleOptionToggle(category)}
                    className={`category-btn ${modalData.options.has(category) ? 'selected' : ''}`}
                  >
                    {buttonText}
                  </button>
                ) : (
                  <h4 className="column-header">{category}</h4>
                )}

                {opts.map(opt => (
                  <button 
                    key={opt} 
                    onClick={() => handleOptionToggle(opt)}
                    className={`option-btn ${modalData.options.has(opt) ? 'selected' : ''}`}
                    disabled={
                      (opt === 'Schäfchen verloren' && modalData.options.has('Solo')) ||
                      (opt === 'Solo verloren' && !modalData.options.has('Solo'))
                    }
                    >
                    {opt}
                  </button>
                ))}
              </div>
            )})}
          </div>
          
          <h4>Spieler</h4>
          <div className="players-grid">
            {players.map(player => (
                <button 
                    key={player.id}
                    onClick={() => handlePlayerClick(player.id)}
                    className={`player-btn ${modalData.playerStates[player.id] || 'neutral'}`}
                >
                    {player.name}
                </button>
            ))}
          </div>
          {activePlayersCount > 4 && (
            <p className="validation-error">
                Es können maximal 4 Spieler an einer Runde teilnehmen.
            </p>
          )}
          
          <h4>Spiel</h4>
          <div className="spiel-summary" aria-live="polite">
            {spielZusammenfassung.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}
          </div>
          
        </div>
        <footer className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Abbrechen</button>
          <button 
            onClick={() => onSave(modalData)} 
            className="save-btn"
            disabled={!isGameTypeSelected || activePlayersCount > 4}
          >
            Speichern
          </button>
        </footer>
      </div>
    </div>
  );
};

const DetailsModal: React.FC<{
  runde: Runde | null;
  onClose: () => void;
}> = ({ runde, onClose }) => {
  if (!runde) return null;

  const { options, winners, losers, finalScore } = runde.details;
  const bockMultiplier = runde.bockArt ? Math.pow(2, runde.bockArt.length) : 1;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="details-modal-title">
      <div className="modal-content details-view" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="details-modal-title">Rundendetails</h2>
          <button onClick={onClose} className="close-modal-btn" aria-label="Schließen">×</button>
        </header>
        <div className="modal-body">
          <h4>Gespielte Optionen</h4>
          <ul className="options-list">
            {options.map(opt => <li key={opt}>{opt}</li>)}
          </ul>
          {winners.length > 0 && (
            <>
              <h4>Gewinner</h4>
              <p>{winners.join(', ')}</p>
            </>
          )}
          {losers.length > 0 && (
            <>
              <h4>Verlierer</h4>
              <p>{losers.join(', ')}</p>
            </>
          )}
          {runde.bockArt && (
             <>
              <h4>Bock-Details</h4>
               <ul className="options-list">
                  <li>Gespielte Runden: {runde.bockArt}</li>
                  <li>Multiplikator: x{bockMultiplier}</li>
               </ul>
            </>
          )}
          <div className="final-score-display">
            Finaler Wert: {finalScore.toFixed(1).replace('.', ',')}
          </div>
        </div>
        <footer className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Schließen</button>
        </footer>
      </div>
    </div>
  );
};


const App = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [runden, setRunden] = useState<Runde[]>([]);
  const [spielwert, setSpielwert] = useState('10/20');
  const [soloWert, setSoloWert] = useState('120');
  const [bockStacks, setBockStacks] = useState<string[][]>([]);
  
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewedRunde, setViewedRunde] = useState<Runde | null>(null);

  const BOCK_ROUND_CHARS = ['B', 'O', 'C', 'K', 'S', 'D', 'A', 'M'];
  
  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlayerName.trim() === '') return;

    const newPlayer: Player = {
      id: `player_${Date.now()}`,
      name: newPlayerName.trim(),
    };

    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
    setIsAddingPlayer(false);
  };

  const handleRemovePlayer = (idToRemove: string) => {
    setPlayers(players.filter(p => p.id !== idToRemove));
    setRunden(prevRunden => prevRunden.map(runde => {
      const newScores = { ...runde.scores };
      delete newScores[idToRemove];
      return { ...runde, scores: newScores };
    }));
  };

  const handleRemoveRunde = (idToRemove: string) => {
    setRunden(runden.filter(r => r.id !== idToRemove));
  };
  
  const handleSaveRunde = useCallback((data: ModalData) => {
    const { options, playerStates } = data;
    
    const isBockRound = bockStacks.length > 0;
    
    // 1. Calculate bock multiplier & art for the CURRENT round
    const bockMultiplier = isBockRound ? Math.pow(2, bockStacks.length) : 1;
    const bockArtForDisplay = isBockRound 
      ? bockStacks
          .map(stack => stack[0])
          .sort((a, b) => BOCK_ROUND_CHARS.indexOf(a) - BOCK_ROUND_CHARS.indexOf(b))
          .join('')
      : '';

    const [gewinnWertStr, verlierWertStr] = spielwert.split('/');

    // 2. Calculate base score
    let baseScore = 0;
    if (options.has('Solo')) {
        baseScore = parseFloat(soloWert) || 0;
    } else {
        const gewinnWert = parseFloat(gewinnWertStr) || 0;
        const verlierWert = parseFloat(verlierWertStr) || 0;

        if (options.has('Alten gewinnen')) {
            baseScore = gewinnWert;
        } else if (options.has('Alten verlieren')) {
            baseScore = verlierWert;
        }
    }

    const nonDoublingOptions = new Set([
      'Alten gewinnen', 'Alten verlieren', 'Solo', 
      'Schäfchen verloren'
    ]);
    
    let finalScoreRaw = baseScore;
    options.forEach(option => {
        if (!nonDoublingOptions.has(option)) {
            finalScoreRaw *= 2;
        }
    });
    
    // 3. Apply bock multiplier
    finalScoreRaw *= bockMultiplier;

    if (options.has('Schäfchen verloren')) {
      const schaefchenWert = parseFloat(gewinnWertStr) || 0;
      finalScoreRaw += schaefchenWert;
    }

    const finalScore = finalScoreRaw / 100;

    // 4. Determine winners and losers and distribute points
    const newScores: Record<string, string> = {};
    players.forEach(p => (newScores[p.id] = '0,0'));

    const winners = players.filter(p => playerStates[p.id] === 'won');
    const losers = players.filter(p => playerStates[p.id] === 'lost');
    
    const isSoloGame = options.has('Solo');
    const isSoloWon = isSoloGame && winners.length === 1 && losers.length > 0;
    const isSoloLost = isSoloGame && losers.length === 1 && winners.length > 0;

    if (isSoloWon) {
        const winnerScore = finalScore * 3;
        winners.forEach(w => {
            newScores[w.id] = winnerScore.toFixed(1).replace('.', ',');
        });
        losers.forEach(l => {
            newScores[l.id] = (-finalScore).toFixed(1).replace('.', ',');
        });
    } else if (isSoloLost) {
        const loserScore = -finalScore * 3;
        losers.forEach(l => {
            newScores[l.id] = loserScore.toFixed(1).replace('.', ',');
        });
        winners.forEach(w => {
            newScores[w.id] = finalScore.toFixed(1).replace('.', ',');
        });
    } else {
        winners.forEach(w => {
            newScores[w.id] = finalScore.toFixed(1).replace('.', ',');
        });
        losers.forEach(l => {
            newScores[l.id] = (-finalScore).toFixed(1).replace('.', ',');
        });
    }

    // 5. Create the round object
    const rundeToAdd: Runde = {
        id: `runde_${Date.now()}`,
        spiel: finalScore.toFixed(1).replace('.', ','),
        scores: newScores,
        details: {
          options: Array.from(options),
          winners: winners.map(p => p.name),
          losers: losers.map(p => p.name),
          finalScore: finalScore
        },
        bockArt: bockArtForDisplay,
    };

    // 6. Update bock state for NEXT rounds
    // a. Consume one round from each active stack
    let updatedStacks = bockStacks
      .map(stack => stack.slice(1))
      .filter(stack => stack.length > 0);
      
    // b. Check for new bock round triggers
    const isReKontra = options.has('Re') && options.has('Kontra');
    let newBockSetsCount = 0;
    if (isSoloGame) newBockSetsCount++;
    if (isReKontra) newBockSetsCount++;
    
    // c. Add new stacks if triggered
    if (players.length > 0) {
      const newStackChars = BOCK_ROUND_CHARS.slice(0, players.length);
      if (newStackChars.length > 0) {
        for (let i = 0; i < newBockSetsCount; i++) {
          updatedStacks.push(newStackChars);
        }
      }
    }
    setBockStacks(updatedStacks);

    setRunden(prevRunden => [rundeToAdd, ...prevRunden]);
    setIsModalOpen(false);
  }, [players, spielwert, soloWert, bockStacks, BOCK_ROUND_CHARS]);
  
  const totalScores = useMemo(() => {
    const totals: Record<string, number> = {};
    players.forEach(p => {
        totals[p.id] = 0;
    });
    runden.forEach(runde => {
        for(const playerId in runde.scores) {
            const scoreValue = parseFloat(runde.scores[playerId].replace(',', '.')) || 0;
            if (totals[playerId] !== undefined) {
                totals[playerId] += scoreValue;
            }
        }
    });
    return totals;
  }, [runden, players]);


  return (
    <div className="container">
      <RundeModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRunde}
        players={players}
        spielwert={spielwert}
        soloWert={soloWert}
        bockStacks={bockStacks}
      />
      <DetailsModal runde={viewedRunde} onClose={() => setViewedRunde(null)} />
      <header className="app-header">
        <div className="header-actions">
            <button 
              onClick={() => setIsAddingPlayer(true)} 
              className="header-btn"
              aria-label="Spieler hinzufügen"
            >
             Spieler hinzufügen
            </button>
            <button onClick={() => setIsModalOpen(true)} className="header-btn primary" disabled={players.length < 1}>
                Neue Runde
            </button>
        </div>
        <div className="game-values-container">
            <div className="spielwert-container">
                <label htmlFor="spielwert">Spielwert:</label>
                <input 
                    id="spielwert"
                    type="text" 
                    value={spielwert} 
                    onChange={e => setSpielwert(e.target.value)} 
                    className="spielwert-input"
                    pattern="\d+(\.\d+)?\/\d+(\.\d+)?"
                    title="Bitte im Format 'gewinn/verlust' eingeben, z.B. 10/20"
                />
            </div>
            <div className="spielwert-container">
                <label htmlFor="solowert">Solospiel:</label>
                <input
                    id="solowert"
                    type="text"
                    value={soloWert}
                    onChange={e => /^\d{0,4}$/.test(e.target.value) && setSoloWert(e.target.value)}
                    className="spielwert-input"
                    maxLength={4}
                    placeholder="120"
                    title="Wert für ein Solospiel (max. 4 Ziffern)."
                />
            </div>
        </div>
      </header>
      
      {isAddingPlayer && (
        <form onSubmit={handleAddPlayer} className="player-form" aria-label="Neuen Spieler hinzufügen">
            <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Spielername eingeben"
            aria-label="Spielername"
            required
            autoFocus
            />
            <button type="submit">Hinzufügen</button>
            <button type="button" onClick={() => setIsAddingPlayer(false)} className="cancel-btn">
                Abbrechen
            </button>
        </form>
      )}

      <div className="scoreboard">
        {players.length > 0 ? (
          <table aria-label="Spielstand">
            <thead>
              <tr>
                <th className="fixed-col">Art</th>
                {players.map((player) => (
                  <th key={player.id}>
                    {player.name}
                    <button onClick={() => handleRemovePlayer(player.id)} className="remove-player-btn" title={`${player.name} entfernen`}>×</button>
                  </th>
                ))}
                <th>Spiel</th>
              </tr>
            </thead>
            <tbody>
              {runden.map((runde) => (
                <tr key={runde.id}>
                  <td className="fixed-col bock-cell">
                    {runde.bockArt}
                  </td>
                  {players.map(player => {
                    const scoreString = runde.scores[player.id];
                    let scoreClass = '';
                    if (scoreString) {
                      const scoreValue = parseFloat(scoreString.replace(',', '.'));
                      if (scoreValue > 0) {
                        scoreClass = 'score-win';
                      } else if (scoreValue < 0) {
                        scoreClass = 'score-loss';
                      }
                    }
                    return (
                      <td key={player.id} className={scoreClass}>
                        {scoreString || '-'}
                      </td>
                    );
                  })}
                  <td className="spiel-cell-clickable" onClick={() => setViewedRunde(runde)}>
                    {runde.spiel}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRemoveRunde(runde.id); }} 
                      className="remove-runde-btn"
                      title="Diese Runde löschen"
                      aria-label="Diese Runde löschen"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
                <tr>
                    <th className="fixed-col">Total</th>
                    {players.map(player => (
                        <th key={player.id}>
                           {totalScores[player.id].toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </th>
                    ))}
                    <td colSpan={1}></td>
                </tr>
            </tfoot>
          </table>
        ) : (
          <p className="no-players">Fügen Sie Spieler hinzu, um das Spiel zu starten.</p>
        )}
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}