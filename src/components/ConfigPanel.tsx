// src/components/ConfigPanel.tsx
import { useState } from 'react';
import type { GeneratorInput, PlayerEvent, TileId } from '../types';
import { parseTileNotation, toTileNotation } from '../utils/tileNotation';

// ==========================================
// Styles
// ==========================================

const styles = {
  section: {
    marginBottom: 16,
    padding: 12,
    border: '1px solid #444',
    borderRadius: 4,
    background: '#2a2a2a',
  },
  label: {
    display: 'block',
    marginBottom: 4,
    fontWeight: 'bold' as const,
    color: '#aaa',
    fontSize: 12,
  },
  input: {
    width: '100%',
    padding: 8,
    fontSize: 14,
    border: '1px solid #555',
    borderRadius: 4,
    background: '#1e1e1e',
    color: '#fff',
    fontFamily: 'monospace',
  },
  select: {
    padding: 8,
    fontSize: 14,
    border: '1px solid #555',
    borderRadius: 4,
    background: '#1e1e1e',
    color: '#fff',
    marginRight: 8,
  },
  smallInput: {
    width: 60,
    padding: 6,
    fontSize: 14,
    border: '1px solid #555',
    borderRadius: 4,
    background: '#1e1e1e',
    color: '#fff',
    textAlign: 'center' as const,
  },
  button: {
    padding: '6px 12px',
    fontSize: 12,
    cursor: 'pointer',
    marginRight: 8,
    border: '1px solid #555',
    borderRadius: 4,
    background: '#333',
    color: '#fff',
  },
  removeButton: {
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
    border: '1px solid #833',
    borderRadius: 4,
    background: '#422',
    color: '#faa',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    padding: 8,
    background: '#333',
    borderRadius: 4,
  },
  help: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
};

// ==========================================
// Types
// ==========================================

interface PlayerEventInput {
  type: PlayerEvent['type'];
  turn?: number; // Required for RIICHI, optional for others (undefined = auto)
  callTarget?: string; // Tile notation format
  callMelds?: string;  // Tile notation format
  discardTile?: string; // Tile notation format
}

export interface ConfigPanelProps {
  onGenerate: (input: GeneratorInput) => void;
}

// ==========================================
// Helper Functions
// ==========================================

const SEAT_NAMES = ['East', 'South', 'West', 'North'];

function createEmptyEvent(): PlayerEventInput {
  return { type: 'CHI', callTarget: '', callMelds: '' };
}

// ==========================================
// Component
// ==========================================

export function ConfigPanel({ onGenerate }: ConfigPanelProps) {
  // Basic config
  const [heroSeat, setHeroSeat] = useState<0 | 1 | 2 | 3>(0);
  const [heroHaipai, setHeroHaipai] = useState('123456789m12345p'); // 14 tiles
  const [heroTurn, setHeroTurn] = useState(6); // Hero's current turn number
  const [akaCount, setAkaCount] = useState(1);
  const [doraIndicator, setDoraIndicator] = useState('7s');

  // Events for all 4 players
  const [events, setEvents] = useState<PlayerEventInput[][]>([[], [], [], []]);

  // Add event
  const addEvent = (seat: number) => {
    const newEvents = [...events];
    newEvents[seat] = [...newEvents[seat], createEmptyEvent()];
    setEvents(newEvents);
  };

  // Remove event
  const removeEvent = (seat: number, index: number) => {
    const newEvents = [...events];
    newEvents[seat] = newEvents[seat].filter((_, i) => i !== index);
    setEvents(newEvents);
  };

  // Update event
  const updateEvent = (seat: number, index: number, field: keyof PlayerEventInput, value: string | number | undefined) => {
    const newEvents = [...events];
    newEvents[seat] = [...newEvents[seat]];
    newEvents[seat][index] = { ...newEvents[seat][index], [field]: value };
    setEvents(newEvents);
  };

  // Build GeneratorInput
  const buildInput = (): GeneratorInput => {
    const haipaiTiles = parseTileNotation(heroHaipai);
    const doraTiles = parseTileNotation(doraIndicator);

    // Build playerEvents
    const playerEvents: [PlayerEvent[], PlayerEvent[], PlayerEvent[], PlayerEvent[]] = [[], [], [], []];
    
    for (let seat = 0; seat < 4; seat++) {
      for (const evt of events[seat]) {
        const event: PlayerEvent = {
          type: evt.type,
          // turn: UI uses 1-based (which turn), internal uses 0-based (array index)
          // So we need -1 conversion
          // undefined -> auto-determine (becomes -1 in solver)
          turn: evt.turn !== undefined ? evt.turn - 1 : undefined,
        };

        if (evt.callTarget) {
          const tiles = parseTileNotation(evt.callTarget);
          if (tiles.length > 0) event.callTarget = tiles[0];
        }

        if (evt.callMelds) {
          const tiles = parseTileNotation(evt.callMelds);
          if (tiles.length > 0) event.callMelds = tiles;
        }

        if (evt.discardTile) {
          const tiles = parseTileNotation(evt.discardTile);
          if (tiles.length > 0) event.discardTile = tiles[0];
        }

        playerEvents[seat].push(event);
      }
    }

    // Build RoundLog
    const nullArray = (n: number) => Array(n).fill(null);

    // 4 players' haipai and draw/discard arrays
    const playerData: (TileId[] | (TileId | null)[])[] = [];
    for (let seat = 0; seat < 4; seat++) {
      if (seat === heroSeat) {
        playerData.push(haipaiTiles);
      } else {
        playerData.push([]);
      }
      playerData.push(nullArray(heroTurn));
      playerData.push(nullArray(heroTurn));
    }

    // RoundLog is a fixed-structure tuple (17 elements)
    // TypeScript cannot infer correct tuple length from spread, use unknown as intermediate
    const roundLog = [
      [0, 0, 0],
      [25000, 25000, 25000, 25000],
      doraTiles,
      [],
      ...playerData, // 12 elements: 4 players x (haipai + draws + discards)
      ['ryuukyoku', [0, 0, 0, 0]],
    ] as unknown as GeneratorInput['roundLog'];

    return {
      roundLog,
      playerEvents,
      heroSeat,
      rule: { aka: akaCount },
    };
  };

  const handleGenerate = () => {
    const input = buildInput();
    console.log('Config Input:', input);
    onGenerate(input);
  };

  // Render event editor
  const renderEventEditor = (seat: number) => {
    const seatEvents = events[seat];

    return (
      <div style={styles.section} key={seat}>
        <div style={styles.row}>
          <span style={{ fontWeight: 'bold', color: seat === heroSeat ? '#4a9' : '#fff' }}>
            {SEAT_NAMES[seat]} {seat === heroSeat ? '(Hero)' : ''}
          </span>
          <button style={styles.button} onClick={() => addEvent(seat)}>
            + Add Event
          </button>
        </div>

        {seatEvents.map((evt, idx) => (
          <div style={styles.eventRow} key={idx}>
            <select
              style={styles.select}
              value={evt.type}
              onChange={(e) => updateEvent(seat, idx, 'type', e.target.value)}
            >
              <option value="CHI">Chi</option>
              <option value="PON">Pon</option>
              <option value="MINKAN">Minkan</option>
              <option value="ANKAN">Ankan</option>
              <option value="KAKAN">Kakan</option>
              <option value="RIICHI">Riichi</option>
            </select>

            {/* RIICHI requires turn, others optional */}
            <label style={{ 
              fontSize: 12, 
              color: evt.type === 'RIICHI' ? '#f99' : '#aaa' 
            }}>
              Turn{evt.type === 'RIICHI' ? '*' : ''}:
            </label>
            <input
              type="number"
              style={{
                ...styles.smallInput,
                borderColor: evt.type === 'RIICHI' && evt.turn === undefined ? '#f66' : '#555',
              }}
              value={evt.turn ?? ''}
              min={1}
              max={18}
              placeholder={evt.type === 'RIICHI' ? 'Req' : 'Auto'}
              onChange={(e) => {
                const val = e.target.value;
                // Keep 1-based (which turn), conversion happens in buildInput
                updateEvent(seat, idx, 'turn', val === '' ? undefined : parseInt(val, 10));
              }}
            />

            {(evt.type === 'CHI' || evt.type === 'PON' || evt.type === 'MINKAN' || evt.type === 'KAKAN') && (
              <>
                <label style={{ fontSize: 12, color: '#aaa' }}>Target:</label>
                <input
                  style={{ ...styles.smallInput, width: 50 }}
                  value={evt.callTarget || ''}
                  placeholder="e.g. 2m"
                  onChange={(e) => updateEvent(seat, idx, 'callTarget', e.target.value)}
                />
              </>
            )}

            {(evt.type === 'CHI' || evt.type === 'PON' || evt.type === 'MINKAN' || evt.type === 'ANKAN') && (
              <>
                <label style={{ fontSize: 12, color: '#aaa' }}>Melds:</label>
                <input
                  style={{ ...styles.smallInput, width: 70 }}
                  value={evt.callMelds || ''}
                  placeholder="e.g. 13m"
                  onChange={(e) => updateEvent(seat, idx, 'callMelds', e.target.value)}
                />
              </>
            )}

            {evt.type === 'RIICHI' && (
              <>
                <label style={{ fontSize: 12, color: '#aaa' }}>Tile:</label>
                <input
                  style={{ ...styles.smallInput, width: 50 }}
                  value={evt.discardTile || ''}
                  placeholder="Random"
                  onChange={(e) => updateEvent(seat, idx, 'discardTile', e.target.value)}
                />
              </>
            )}

            <button style={styles.removeButton} onClick={() => removeEvent(seat, idx)}>
              Remove
            </button>
          </div>
        ))}

        {seatEvents.length === 0 && (
          <div style={{ color: '#666', fontSize: 12 }}>No events</div>
        )}
      </div>
    );
  };

  return (
    <div style={{ color: '#fff' }}>
      <h3 style={{ marginTop: 0 }}>Configuration</h3>

      {/* Basic config */}
      <div style={styles.section}>
        <div style={styles.row}>
          <label style={{ ...styles.label, marginBottom: 0 }}>Hero Seat:</label>
          <select
            style={styles.select}
            value={heroSeat}
            onChange={(e) => setHeroSeat(parseInt(e.target.value) as 0 | 1 | 2 | 3)}
          >
            {SEAT_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>

          <label style={{ ...styles.label, marginBottom: 0 }}>Hero Turn:</label>
          <input
            type="number"
            style={styles.smallInput}
            value={heroTurn}
            min={1}
            max={18}
            onChange={(e) => setHeroTurn(parseInt(e.target.value) || 6)}
          />

          <label style={{ ...styles.label, marginBottom: 0 }}>Aka Count:</label>
          <input
            type="number"
            style={styles.smallInput}
            value={akaCount}
            min={0}
            max={4}
            onChange={(e) => setAkaCount(parseInt(e.target.value) || 0)}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={styles.label}>Hero Final Hand (14 tiles, after draw)</label>
          <input
            style={styles.input}
            value={heroHaipai}
            onChange={(e) => setHeroHaipai(e.target.value)}
            placeholder="e.g. 123456789m12345p"
          />
          <div style={styles.help}>
            Hero's hand after drawing on specified turn (14 tiles). Format: number+suit(m/p/s/z), 0=red5, z=honors(1-7=ESWN+dragons)
          </div>
          <div style={styles.help}>
            Current: {parseTileNotation(heroHaipai).length} tiles - [{toTileNotation(parseTileNotation(heroHaipai))}]
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={styles.label}>Dora Indicator</label>
          <input
            style={{ ...styles.input, width: 100 }}
            value={doraIndicator}
            onChange={(e) => setDoraIndicator(e.target.value)}
            placeholder="e.g. 7s"
          />
        </div>
      </div>

      {/* Player events */}
      <h4>Player Events</h4>
      {[0, 1, 2, 3].map(seat => renderEventEditor(seat))}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        style={{
          ...styles.button,
          padding: '12px 24px',
          fontSize: 16,
          background: '#246',
          border: '1px solid #48a',
          marginTop: 12,
        }}
      >
        Generate Log
      </button>
    </div>
  );
}
