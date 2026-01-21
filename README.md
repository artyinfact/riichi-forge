# Riichi Forge 🀄

**Reverse Mahjong Log Generator** - A tool for generating and completing Tenhou-format game logs.

## Introduction

Riichi Forge is a mahjong game log generation tool built with TypeScript that can:

- 🧩 **Complete Incomplete Logs**: Given Hero's hand and partial known information, automatically fill in opponents' draws/discards
- 🎯 **Scripted Calls**: Pre-set player chi/pon/kan/riichi actions, and the generator will trigger them at the appropriate time
- ✅ **Input Validation**: Strict type checking and data validation to ensure generated logs are correctly formatted
- 🔗 **Tenhou Compatible**: Outputs standard Tenhou JSON format, directly playable in [Tenhou Player](https://tenhou.net/6/)

## Tech Stack

- **React 19** + **TypeScript 5.9** + **Vite 7**
- **Vitest** for unit testing

## Project Structure

```
src/
├── types/
│   └── index.ts              # Core type definitions (TileId, RoundLog, TenhouLogJson, etc.)
├── utils/
│   ├── tile.ts               # Tile utility functions (red dora handling, shuffle, sort)
│   ├── tileNotation.ts       # Tile notation parser (e.g., "123m456p")
│   └── validator.ts          # Input validation (tile IDs, call strings, RoundLog structure)
├── core/
│   ├── solver/
│   │   └── NaiveSolver.ts    # Log completion solver
│   └── generator/
│       └── LogGenerator.ts   # Tenhou JSON generator
├── scripts/
│   ├── index.ts              # Script entry point
│   └── completeLog.ts        # CLI completion tool
└── components/
    ├── ConfigPanel.tsx       # Configuration input panel
    └── DebugPanel.tsx        # Debug React component
```

## Core Concepts

### Tile ID Encoding (TileId)

```
Number tiles: 11-19 (man/characters), 21-29 (pin/circles), 31-39 (sou/bamboo)
Honor tiles:  41-47 (East, South, West, North, White, Green, Red)
Red dora:     51 (red 5m), 52 (red 5p), 53 (red 5s)
```

### Discard Priority (NaiveSolver)

When completing opponent discards, the solver selects tiles in this priority order:

1. **Genbutsu (Safe tiles)** - Riichi player's discards + all discards after riichi
2. **Honor tiles** - 41-47
3. **Terminals** - 1/9
4. **28** - 2/8
5. **37** - 3/7
6. **Middle tiles** - 4/5/6

### Tenhou Log Format

A complete `RoundLog` contains 17 elements:

```typescript
[
  [round, honba, riichi_sticks],  // Round info
  [east_pts, south_pts, ...],     // Starting points
  [dora_indicators],              // Dora indicators
  [ura_dora_indicators],          // Ura-dora indicators
  // Four players' data (3 elements each)
  haipai_0, draws_0, discards_0,  // East
  haipai_1, draws_1, discards_1,  // South
  haipai_2, draws_2, discards_2,  // West
  haipai_3, draws_3, discards_3,  // North
  result                          // Result
]
```

## Usage

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

### CLI Tool

Complete an incomplete log:

```bash
# Read from file
npx ts-node src/scripts/completeLog.ts input.json output.json

# Read from stdin
cat input.json | npx ts-node src/scripts/completeLog.ts --stdin --pretty

# Generate Tenhou player URL
npx ts-node src/scripts/completeLog.ts --url input.json
```

### Input Format (GeneratorInput)

```typescript
{
  "roundLog": [...],  // RoundLog structure, fill unknown positions with null
  "playerEvents": [   // Pre-set events for all 4 players
    [],               // East's events
    [                 // South's events
      { "type": "PON", "callTarget": 15 }
    ],
    [],               // West's events
    []                // North's events
  ],
  "heroSeat": 0,      // Hero's seat (0-3)
  "rule": {
    "aka": 1          // Red dora count per suit
  }
}
```

### Scripted Events (PlayerEvent)

Supported event types:

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `CHI` | Chi (sequence) | `callTarget`, `callMelds` |
| `PON` | Pon (triplet) | `callTarget` |
| `MINKAN` | Open kan | `callTarget` |
| `ANKAN` | Closed kan | `callMelds` (4 tiles) |
| `KAKAN` | Added kan | `callTarget` |
| `RIICHI` | Riichi | `discardTile` |

## API Example

```typescript
import { generate, generateJson } from './core/generator/LogGenerator';
import type { GeneratorInput } from './types';

const input: GeneratorInput = {
  roundLog: [
    [0, 0, 0],                    // East 1, 0 honba
    [25000, 25000, 25000, 25000], // Starting points
    [15],                         // Dora indicator: 5m
    [],                           // No ura-dora
    // Hero (East) complete info
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 41, 41, 42, 42], // Hand
    [21, 22, 23],                 // Known draws
    [11, 60, 42],                 // Known discards (60 = tsumogiri)
    // Opponents left empty, filled by Solver
    [], [], [],                   // South
    [], [], [],                   // West
    [], [], [],                   // North
    ['ryuukyoku', [0, 0, 0, 0]]   // Result
  ],
  playerEvents: [[], [], [], []], // No pre-set events
  heroSeat: 0,
  rule: { aka: 1 }
};

// Generate complete TenhouLogJson
const result = generate(input);

// Or directly generate JSON string
const json = generateJson(input, {}, true);  // pretty = true
```

## Development

### Run Tests

```bash
npm test
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## License

MIT
