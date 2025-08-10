
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
  id:string;
  scores: Record<string, string>;
  spiel: string;
  details: RundeDetails;
  bockArt: string;
}

// Definiert die Struktur eines archivierten Spiels
interface GameArchive {
  id: string;
  timestamp: number;
  players: Player[];
  runden: Runde[];
  spielwert: string;
  soloWert: string;
}

type PlayerStatus = 'won' | 'lost' | 'neutral';

interface ModalData {
  options: Set<string>;
  playerStates: Record<string, PlayerStatus>;
}

const gameOptions = {
  'Alten gewinnen': ['Keine 90', 'Keine 60', 'Keine 30', 'schwarz'],
  'Alten verlieren': ['Keine 90 verloren', 'Keine 60 verloren', 'Keine 30 verloren', 'schwarz verloren'],
  'Ansagen': ['Re', 'Kontra'],
  'Fehl-Ansagen': ['Keine 90 gesagt', 'Keine 60 gesagt', 'Keine 30 gesagt', 'schwarz gesagt'],
  'Solo': ['Solo verloren'],
  'Fuchs gefangen': ['Fuchs gefangen 1', 'Fuchs gefangen 2'],
  'Fuchs verloren': ['Fuchs verloren 1', 'Fuchs verloren 2'],
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
            newOptions.delete('Fuchs gefangen 1');
            newOptions.delete('Fuchs gefangen 2');
            newOptions.delete('Fuchs verloren 1');
            newOptions.delete('Fuchs verloren 2');
        }
      }
      return { ...prev, options: newOptions };
    });
  };

  const handlePlayerClick = (playerId: string) => {
    setModalData(prev => {
      const currentStatus = prev.playerStates[playerId];
      let nextStatus: PlayerStatus = 'won';
      if (currentStatus === 'won') {
        nextStatus = 'lost';
      } else if (currentStatus === 'lost') {
        nextStatus = 'neutral';
      }
      
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
      'Fuchs gefangen 1', 'Fuchs gefangen 2',
      'Fuchs verloren 1', 'Fuchs verloren 2'
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

    const [gewinnWertStr] = spielwert.split('/');
    const fuchsWert = parseFloat(gewinnWertStr) || 0;
    if (options.has('Fuchs gefangen 1')) {
        finalScore += fuchsWert;
    }
    if (options.has('Fuchs gefangen 2')) {
        finalScore += fuchsWert;
    }
    if (options.has('Fuchs verloren 1')) {
        finalScore -= fuchsWert;
    }
    if (options.has('Fuchs verloren 2')) {
        finalScore -= fuchsWert;
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
            <div className="options-container">
                {/* Row 1: Main game types */}
                <div className="options-row main-game-types">
                    <div className="options-column">
                        <button
                          onClick={() => handleOptionToggle('Alten gewinnen')}
                          className={`category-btn large ${modalData.options.has('Alten gewinnen') ? 'selected' : ''}`}
                        >
                          Alten gewinnen ({gewinnWert || '?'})
                        </button>
                    </div>
                    <div className="options-column">
                        <button
                          onClick={() => handleOptionToggle('Alten verlieren')}
                          className={`category-btn large ${modalData.options.has('Alten verlieren') ? 'selected' : ''}`}
                        >
                          Alten verlieren ({verlierWert || '?'})
                        </button>
                    </div>
                </div>

                {/* Row 2: Sub-options, shown conditionally */}
                {isGameTypeSelected && (
                  <div className="options-row sub-options">
                    <div className="options-column">
                      <h4 className="column-header">Gespielt</h4>
                      {gameOptions['Alten gewinnen'].map(opt => (
                        <button 
                          key={opt} 
                          onClick={() => handleOptionToggle(opt)}
                          className={`option-btn ${modalData.options.has(opt) ? 'selected' : ''}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <div className="options-column">
                      <h4 className="column-header">Gesagt</h4>
                      {gameOptions['Fehl-Ansagen'].map(opt => (
                        <button 
                          key={opt} 
                          onClick={() => handleOptionToggle(opt)}
                          className={`option-btn ${modalData.options.has(opt) ? 'selected' : ''}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <div className="options-column">
                      <h4 className="column-header">Verloren</h4>
                      {gameOptions['Alten verlieren'].map(opt => (
                        <button 
                          key={opt} 
                          onClick={() => handleOptionToggle(opt)}
                          className={`option-btn ${modalData.options.has(opt) ? 'selected' : ''}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <hr className="options-divider" />

                {/* Row 3: Other options */}
                <div className="options-row other-options">
                    <div className="other-options-group">
                        <div className="options-column">
                            <button
                              onClick={() => handleOptionToggle('Solo')}
                              className={`category-btn ${modalData.options.has('Solo') ? 'selected' : ''}`}
                            >
                              Solo ({soloWert || '?'})
                            </button>
                            {gameOptions['Solo'].map(opt => (
                              <button 
                                key={opt} 
                                onClick={() => handleOptionToggle(opt)}
                                className={`option-btn ${modalData.options.has(opt) ? 'selected' : ''}`}
                                disabled={!modalData.options.has('Solo')}
                              >
                                {opt}
                              </button>
                            ))}
                        </div>
                        <div className="options-column">
                            <h4 className="column-header">Fuchs gefangen</h4>
                            {gameOptions['Fuchs gefangen'].map(opt => (
                              <button 
                                key={opt} 
                                onClick={() => handleOptionToggle(opt)}
                                className={`option-btn ${modalData.options.has(opt) ? 'selected' : ''}`}
                                disabled={modalData.options.has('Solo')}
                              >
                                Fuchs gefangen
                              </button>
                            ))}
                        </div>
                        <div className="options-column">
                            <h4 className="column-header">Fuchs verloren</h4>
                            {gameOptions['Fuchs verloren'].map(opt => (
                              <button 
                                key={opt} 
                                onClick={() => handleOptionToggle(opt)}
                                className={`option-btn ${modalData.options.has(opt) ? 'selected' : ''}`}
                                disabled={modalData.options.has('Solo')}
                              >
                                Fuchs verloren
                              </button>
                            ))}
                        </div>
                    </div>
                    <div className="other-options-group">
                        <div className="options-column">
                            <h4 className="column-header">Ansagen</h4>
                            {gameOptions['Ansagen'].map(opt => (
                              <button 
                                key={opt} 
                                onClick={() => handleOptionToggle(opt)}
                                className={`option-btn ${modalData.options.has(opt) ? 'selected' : ''}`}
                              >
                                {opt}
                              </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          
          <div className="h4-container">
            <h4>Spieler</h4>
            <span className="player-info-box">1x klicken: gewonnen, 2x klicken: verloren, Aussetzende Spieler nicht anklicken</span>
          </div>
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
          {(activePlayersCount > 0 && activePlayersCount !== 4) && (
            <p className="validation-error">
                Es müssen genau 4 Spieler an einer Runde teilnehmen.
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
            disabled={!isGameTypeSelected || activePlayersCount !== 4}
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
            {options.map((opt, index) => <li key={`${opt}-${index}`}>{opt}</li>)}
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


const HistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  history: GameArchive[];
  onView: (gameId: string) => void;
  onContinue: (gameId: string) => void;
  onDelete: (gameId: string) => void;
}> = ({ isOpen, onClose, history, onView, onContinue, onDelete }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
      <div className="modal-content history-view">
        <header className="modal-header">
          <h2 id="history-modal-title">Spielverlauf</h2>
          <button onClick={onClose} className="close-modal-btn" aria-label="Schließen">×</button>
        </header>
        <div className="modal-body">
          {history.length === 0 ? (
            <p className="no-history">Keine gespeicherten Spiele vorhanden.</p>
          ) : (
            <ul className="history-list">
              {history.map(game => (
                <li key={game.id} className="history-item">
                  <div className="history-item-info">
                    <span className="history-item-date">
                      {new Date(game.timestamp).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="history-item-players">
                      {game.players.map(p => p.name).join(', ')}
                    </span>
                  </div>
                  <div className="history-item-actions">
                    <button onClick={() => onView(game.id)} className="action-btn view-btn">Ansehen</button>
                    <button onClick={() => onContinue(game.id)} className="action-btn continue-btn">Fortsetzen</button>
                    <button onClick={() => onDelete(game.id)} className="action-btn delete-btn">Löschen</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Schließen</button>
        </footer>
      </div>
    </div>
  );
};

const AddPlayersModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (names: string[]) => void;
  initialPlayers: Player[];
}> = ({ isOpen, onClose, onSave, initialPlayers }) => {
  const [playerNames, setPlayerNames] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const initialNames = initialPlayers.map(p => p.name);
      const emptySlots = Array(7 - initialNames.length).fill('');
      setPlayerNames([...initialNames, ...emptySlots]);
    }
  }, [isOpen, initialPlayers]);

  const handleNameChange = (index: number, name: string) => {
    const newPlayerNames = [...playerNames];
    newPlayerNames[index] = name;
    setPlayerNames(newPlayerNames);
  };

  const handleSaveClick = () => {
    const finalNames = playerNames.filter(name => name.trim() !== '');
    onSave(finalNames);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-players-modal-title">
      <div className="modal-content add-players-modal">
        <header className="modal-header">
          <h2 id="add-players-modal-title">Spieler verwalten</h2>
          <button onClick={onClose} className="close-modal-btn" aria-label="Schließen">×</button>
        </header>
        <div className="modal-body">
          <p>Gib die Namen der Mitspieler ein. Es können bis zu 7 Spieler teilnehmen. Leere Felder werden ignoriert.</p>
          <div className="player-inputs-grid">
            {playerNames.map((name, index) => (
              <div key={index} className="player-input-item">
                <label htmlFor={`player-input-${index}`}>Position {index + 1}</label>
                <input
                  id={`player-input-${index}`}
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  placeholder="Spielername"
                  autoFocus={index === initialPlayers.length}
                />
              </div>
            ))}
          </div>
        </div>
        <footer className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Abbrechen</button>
          <button onClick={handleSaveClick} className="save-btn">
            Speichern
          </button>
        </footer>
      </div>
    </div>
  );
};


const App = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [runden, setRunden] = useState<Runde[]>([]);
  const [spielwert, setSpielwert] = useState('10/20');
  const [soloWert, setSoloWert] = useState('50');
  const [bockStacks, setBockStacks] = useState<string[][]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewedRunde, setViewedRunde] = useState<Runde | null>(null);

  const [history, setHistory] = useState<GameArchive[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [viewedGameId, setViewedGameId] = useState<string | null>(null);
  const [isAddPlayersModalOpen, setIsAddPlayersModalOpen] = useState(false);
  
  const isReadOnly = viewedGameId !== null;

  // Load history from localStorage on initial render
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('dokoHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error("Could not load game history:", error);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('dokoHistory', JSON.stringify(history));
    } catch (error) {
      console.error("Could not save game history:", error);
    }
  }, [history]);

  const BOCK_ROUND_CHARS = ['B', 'O', 'C', 'K', 'S', 'D', 'A'];

  const recalculateBockStacks = useCallback((allRunden: Runde[], currentPlayers: Player[]): string[][] => {
    let bockStateForNextRound: string[][] = [];
    
    // Runden are stored newest first, so we reverse to process chronologically.
    const chronologicalRunden = [...allRunden].reverse();

    for (const runde of chronologicalRunden) {
        const bockStacksForThisRunde = bockStateForNextRound;

        // Calculate the state AFTER this round was played (logic from handleSaveRunde)
        // 1. Consume a level from the stacks that were active for this round.
        let updatedStacks = bockStacksForThisRunde.map(stack => stack.slice(1)).filter(stack => stack.length > 0);

        // 2. Add new stacks if this round triggered them.
        const options = new Set(runde.details.options);
        const isReKontra = options.has('Re') && options.has('Kontra');
        const isSoloGame = options.has('Solo');
        let newBockSetsCount = (isSoloGame ? 1 : 0) + (isReKontra ? 1 : 0);
        
        if (currentPlayers.length > 0 && newBockSetsCount > 0) {
          const newStackChars = BOCK_ROUND_CHARS.slice(0, currentPlayers.length);
          if (newStackChars.length > 0) {
            for (let i = 0; i < newBockSetsCount; i++) updatedStacks.push(newStackChars);
          }
        }
        
        bockStateForNextRound = updatedStacks;
    }

    return bockStateForNextRound;
  }, [BOCK_ROUND_CHARS]);
  
  const handleSavePlayers = (names: string[]) => {
    const newPlayers = names.map((name, index) => ({
      id: `player_${index}_${Date.now()}`,
      name: name.trim(),
    }));
    setPlayers(newPlayers);
    setRunden([]);
    setBockStacks([]);
    setIsAddPlayersModalOpen(false);
  };

  const handleRemovePlayer = (idToRemove: string) => {
    if (isReadOnly) return;
    setPlayers(players.filter(p => p.id !== idToRemove));
    setRunden(prevRunden => prevRunden.map(runde => {
      const newScores = { ...runde.scores };
      delete newScores[idToRemove];
      return { ...runde, scores: newScores };
    }));
  };

  const handleRemoveRunde = (idToRemove: string) => {
    if (isReadOnly) return;
    const updatedRunden = runden.filter(r => r.id !== idToRemove);
    setRunden(updatedRunden);
    
    const newBockStacks = recalculateBockStacks(updatedRunden, players);
    setBockStacks(newBockStacks);
  };
  
  const handleSaveRunde = useCallback((data: ModalData) => {
    const { options, playerStates } = data;
    
    const isBockRound = bockStacks.length > 0;
    
    const bockMultiplier = isBockRound ? Math.pow(2, bockStacks.length) : 1;
    const bockArtForDisplay = isBockRound 
      ? bockStacks
          .map(stack => stack[0])
          .sort((a, b) => BOCK_ROUND_CHARS.indexOf(a) - BOCK_ROUND_CHARS.indexOf(b))
          .join('')
      : '';

    const [gewinnWertStr, verlierWertStr] = spielwert.split('/');

    let baseScore = 0;
    if (options.has('Solo')) {
        baseScore = parseFloat(soloWert) || 0;
    } else {
        const gewinnWert = parseFloat(gewinnWertStr) || 0;
        const verlierWert = parseFloat(verlierWertStr) || 0;
        if (options.has('Alten gewinnen')) baseScore = gewinnWert;
        else if (options.has('Alten verlieren')) baseScore = verlierWert;
    }

    const nonDoublingOptions = new Set([
        'Alten gewinnen', 'Alten verlieren', 'Solo',
        'Fuchs gefangen 1', 'Fuchs gefangen 2',
        'Fuchs verloren 1', 'Fuchs verloren 2'
    ]);
    let finalScoreRaw = baseScore;
    options.forEach(option => {
        if (!nonDoublingOptions.has(option)) finalScoreRaw *= 2;
    });
    
    finalScoreRaw *= bockMultiplier;

    const fuchsWert = parseFloat(gewinnWertStr) || 0;
    if (options.has('Fuchs gefangen 1')) {
      finalScoreRaw += fuchsWert;
    }
    if (options.has('Fuchs gefangen 2')) {
      finalScoreRaw += fuchsWert;
    }
    if (options.has('Fuchs verloren 1')) {
      finalScoreRaw -= fuchsWert;
    }
    if (options.has('Fuchs verloren 2')) {
      finalScoreRaw -= fuchsWert;
    }

    const finalScore = finalScoreRaw / 100;

    const newScores: Record<string, string> = {};
    players.forEach(p => (newScores[p.id] = '0,0'));

    const winners = players.filter(p => playerStates[p.id] === 'won');
    const losers = players.filter(p => playerStates[p.id] === 'lost');
    
    const isSoloGame = options.has('Solo');
    const isSoloWon = isSoloGame && winners.length === 1 && losers.length > 0;
    const isSoloLost = isSoloGame && losers.length === 1 && winners.length > 0;

    if (isSoloWon) {
        winners.forEach(w => newScores[w.id] = (finalScore * 3).toFixed(1).replace('.', ','));
        losers.forEach(l => newScores[l.id] = (-finalScore).toFixed(1).replace('.', ','));
    } else if (isSoloLost) {
        losers.forEach(l => newScores[l.id] = (-finalScore * 3).toFixed(1).replace('.', ','));
        winners.forEach(w => newScores[w.id] = finalScore.toFixed(1).replace('.', ','));
    } else {
        winners.forEach(w => newScores[w.id] = finalScore.toFixed(1).replace('.', ','));
        losers.forEach(l => newScores[l.id] = (-finalScore).toFixed(1).replace('.', ','));
    }
    
    const displayOptions = Array.from(options).map(opt => {
        if (opt.startsWith('Fuchs gefangen')) return 'Fuchs gefangen';
        if (opt.startsWith('Fuchs verloren')) return 'Fuchs verloren';
        return opt;
    });

    const rundeToAdd: Runde = {
        id: `runde_${Date.now()}`,
        spiel: finalScore.toFixed(1).replace('.', ','),
        scores: newScores,
        details: {
          options: displayOptions,
          winners: winners.map(p => p.name),
          losers: losers.map(p => p.name),
          finalScore: finalScore
        },
        bockArt: bockArtForDisplay,
    };

    let updatedStacks = bockStacks.map(stack => stack.slice(1)).filter(stack => stack.length > 0);
    const isReKontra = options.has('Re') && options.has('Kontra');
    let newBockSetsCount = (isSoloGame ? 1 : 0) + (isReKontra ? 1 : 0);
    
    if (players.length > 0) {
      const newStackChars = BOCK_ROUND_CHARS.slice(0, players.length);
      if (newStackChars.length > 0) {
        for (let i = 0; i < newBockSetsCount; i++) updatedStacks.push(newStackChars);
      }
    }
    setBockStacks(updatedStacks);

    setRunden(prevRunden => [rundeToAdd, ...prevRunden]);
    setIsModalOpen(false);
  }, [players, spielwert, soloWert, bockStacks, BOCK_ROUND_CHARS]);

  const resetGame = () => {
    setPlayers([]);
    setRunden([]);
    setBockStacks([]);
    setViewedGameId(null);
  };

  const handleSaveAndEndGame = () => {
    if (players.length === 0 || runden.length === 0) {
      alert("Es muss mindestens ein Spieler und eine Runde vorhanden sein, um das Spiel zu speichern.");
      return;
    }

    const newArchive: GameArchive = {
      id: `game_${Date.now()}`,
      timestamp: Date.now(),
      players,
      runden,
      spielwert,
      soloWert,
    };

    setHistory(prev => [newArchive, ...prev]);
    resetGame();
  };

  const handleViewGame = (gameId: string) => {
    const gameToView = history.find(g => g.id === gameId);
    if (gameToView) {
      setPlayers(gameToView.players);
      setRunden(gameToView.runden);
      setSpielwert(gameToView.spielwert);
      setSoloWert(gameToView.soloWert);
      setBockStacks([]); // Bocks are not part of history view
      setViewedGameId(gameId);
      setIsHistoryOpen(false);
    }
  };
  
  const handleContinueGame = (gameId: string) => {
    const gameToContinue = history.find(g => g.id === gameId);
    if (gameToContinue) {
      // Load game state
      setPlayers(gameToContinue.players);
      setRunden(gameToContinue.runden);
      setSpielwert(gameToContinue.spielwert);
      setSoloWert(gameToContinue.soloWert);
      
      // Recalculate bock stacks for the continued game
      const bockStacksForContinuedGame = recalculateBockStacks(gameToContinue.runden, gameToContinue.players);
      setBockStacks(bockStacksForContinuedGame);

      // Set to active game mode
      setViewedGameId(null); 
      
      // Remove the game from history as it's now active
      setHistory(prev => prev.filter(g => g.id !== gameId));
      
      // Close the modal
      setIsHistoryOpen(false);
    }
  };

  const handleDeleteGame = (gameId: string) => {
    if (window.confirm("Möchten Sie dieses Spiel wirklich endgültig löschen?")) {
      setHistory(prev => prev.filter(g => g.id !== gameId));
    }
  };
  
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
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onView={handleViewGame}
        onContinue={handleContinueGame}
        onDelete={handleDeleteGame}
      />
      <AddPlayersModal
        isOpen={isAddPlayersModalOpen}
        onClose={() => setIsAddPlayersModalOpen(false)}
        onSave={handleSavePlayers}
        initialPlayers={players}
      />
      <header className="app-header">
        <div className="header-actions">
           {isReadOnly ? (
               <button onClick={resetGame} className="header-btn primary">Neues Spiel</button>
           ) : (
             <>
                <button 
                  onClick={() => setIsAddPlayersModalOpen(true)} 
                  className="header-btn manage-players-btn"
                  disabled={isReadOnly}
                  aria-label="Spieler verwalten"
                >
                 Spieler verwalten
                </button>
                <button onClick={() => setIsModalOpen(true)} className="header-btn primary" disabled={players.length < 4 || isReadOnly}>
                    Neue Runde
                </button>
             </>
           )}
           <button onClick={() => setIsHistoryOpen(true)} className="header-btn">Verlauf</button>
        </div>
        { !isReadOnly && (
            <div className="game-actions">
                <button onClick={handleSaveAndEndGame} className="header-btn save-game-btn" disabled={players.length === 0 || runden.length === 0}>
                    Spiel speichern & beenden
                </button>
            </div>
        )}
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
                    disabled={isReadOnly}
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
                    disabled={isReadOnly}
                />
            </div>
        </div>
      </header>

      <div className="scoreboard">
        {players.length > 0 ? (
          <table aria-label="Spielstand">
            <thead>
              <tr>
                <th className="fixed-col">Art</th>
                {players.map((player) => (
                  <th key={player.id}>
                    {player.name}
                    {!isReadOnly && <button onClick={() => handleRemovePlayer(player.id)} className="remove-player-btn" title={`${player.name} entfernen`}>×</button>}
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
                    {!isReadOnly && 
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveRunde(runde.id); }} 
                        className="remove-runde-btn"
                        title="Diese Runde löschen"
                        aria-label="Diese Runde löschen"
                      >
                        ×
                      </button>
                    }
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
          <p 
            className={`no-players ${!isReadOnly ? 'clickable' : ''}`}
            onClick={() => !isReadOnly && setIsAddPlayersModalOpen(true)}
            role={!isReadOnly ? 'button' : undefined}
            tabIndex={!isReadOnly ? 0 : -1}
          >
            {isReadOnly ? "Altes Spiel wird angezeigt." : "Fügen Sie Spieler hinzu, um das Spiel zu starten."}
          </p>
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
