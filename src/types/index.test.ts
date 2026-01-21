// src/types/index.test.ts
import { describe, it, expect } from 'vitest';
import type {
  TileId,
  ActionType,
  CallDetails,
  TurnAction,
  SolvedPath,
  PlayerEvent,
  TenhouJsonDraw,
  TenhouJsonDiscard,
  PlayerLogBlock,
  ResultType,
  ScoreChanges,
  WinInfo,
  ResultBlock,
  RoundLog,
  GeneratorInput,
  TenhouRule,
  TenhouLogJson,
} from './index';

/**
 * These tests verify that types are correctly defined and can be used.
 * They don't test runtime behavior, just type correctness.
 */

describe('types', () => {
  describe('TileId', () => {
    it('should accept valid tile numbers', () => {
      const tile1: TileId = 11; // 1m
      const tile2: TileId = 51; // red 5m
      const tile3: TileId = 47; // chun
      expect(tile1).toBe(11);
      expect(tile2).toBe(51);
      expect(tile3).toBe(47);
    });
  });

  describe('ActionType', () => {
    it('should accept valid action types', () => {
      const actions: ActionType[] = [
        'DRAW',
        'CHI',
        'PON',
        'MINKAN',
        'ANKAN',
        'KAKAN',
        'RIICHI',
      ];
      expect(actions.length).toBe(7);
    });
  });

  describe('CallDetails', () => {
    it('should represent chi call', () => {
      const chi: CallDetails = {
        type: 'CHI',
        calledTile: 14,
        meldedTiles: [13, 15],
        fromSeat: 3,
      };
      expect(chi.type).toBe('CHI');
      expect(chi.meldedTiles.length).toBe(2);
    });

    it('should represent ankan without calledTile', () => {
      const ankan: CallDetails = {
        type: 'ANKAN',
        meldedTiles: [15, 15, 15, 15],
      };
      expect(ankan.calledTile).toBeUndefined();
      expect(ankan.meldedTiles.length).toBe(4);
    });
  });

  describe('TurnAction', () => {
    it('should represent a normal draw/discard turn', () => {
      const turn: TurnAction = {
        turnNumber: 1,
        actionType: 'DRAW',
        drawTile: 11,
        discardTile: 19,
        isTsumogiri: false,
      };
      expect(turn.turnNumber).toBe(1);
    });

    it('should represent a riichi turn', () => {
      const turn: TurnAction = {
        turnNumber: 5,
        actionType: 'RIICHI',
        drawTile: 15,
        discardTile: 19,
        isRiichiDeclaration: true,
      };
      expect(turn.isRiichiDeclaration).toBe(true);
    });

    it('should represent a kan turn with call info', () => {
      const turn: TurnAction = {
        turnNumber: 3,
        actionType: 'ANKAN',
        drawTile: 15,
        callInfo: {
          type: 'ANKAN',
          meldedTiles: [15, 15, 15, 15],
        },
        discardTile: 0, // placeholder
      };
      expect(turn.callInfo?.type).toBe('ANKAN');
      expect(turn.discardTile).toBe(0);
    });
  });

  describe('SolvedPath', () => {
    it('should contain start hand and turns', () => {
      const path: SolvedPath = {
        startHand: [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24],
        turns: [],
      };
      expect(path.startHand.length).toBe(13);
      expect(path.turns.length).toBe(0);
    });
  });

  describe('PlayerEvent', () => {
    it('should represent riichi event', () => {
      const event: PlayerEvent = {
        type: 'RIICHI',
        turn: 5,
        discardTile: 15,
      };
      expect(event.type).toBe('RIICHI');
    });

    it('should represent chi event', () => {
      const event: PlayerEvent = {
        type: 'CHI',
        callTarget: 14,
        callMelds: [13, 15],
      };
      expect(event.callMelds?.length).toBe(2);
    });
  });

  describe('TenhouJsonDraw', () => {
    it('should accept number, string, or null', () => {
      const draws: TenhouJsonDraw[] = [
        11, // normal draw
        'c121113', // chi
        'p181818', // pon
        null, // unknown
      ];
      expect(draws.length).toBe(4);
    });
  });

  describe('TenhouJsonDiscard', () => {
    it('should accept number, string, or null', () => {
      const discards: TenhouJsonDiscard[] = [
        11, // normal discard
        60, // tsumogiri
        0, // kan placeholder
        'r15', // riichi
        null, // unknown
      ];
      expect(discards.length).toBe(5);
    });
  });

  describe('PlayerLogBlock', () => {
    it('should be a tuple of [haipai, draws, discards]', () => {
      const block: PlayerLogBlock = [
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24], // haipai
        [25, 26, 'c272829'], // draws
        [11, 60, 12], // discards
      ];
      expect(block[0].length).toBe(13);
      expect(block[1].length).toBe(3);
      expect(block[2].length).toBe(3);
    });
  });

  describe('ResultType', () => {
    it('should include all result types', () => {
      const results: ResultType[] = [
        '和了',
        '流局',
        '全員聴牌',
        '全員不聴',
        '流し満貫',
        '九種九牌',
        '三家和了',
        '四風連打',
        '四家立直',
        '四槓散了',
      ];
      expect(results.length).toBe(10);
    });
  });

  describe('ScoreChanges', () => {
    it('should be an array of numbers', () => {
      const changes: ScoreChanges = [-2000, 6000, -2000, -2000];
      expect(changes.reduce((a, b) => a + b, 0)).toBe(0); // Zero-sum
    });
  });

  describe('WinInfo', () => {
    it('should represent tsumo win info', () => {
      const info: WinInfo = [
        1, // winner
        1, // target (same = tsumo)
        1, // winner again
        '30符3飜2000点∀',
        '断幺九(1飜)',
        '赤ドラ(2飜)',
      ];
      expect(info[0]).toBe(info[1]); // tsumo
    });

    it('should represent ron win info', () => {
      const info: WinInfo = [
        1, // winner
        3, // target (different = ron)
        1, // winner again
        '30符2飜3900点',
        '立直(1飜)',
        '平和(1飜)',
      ];
      expect(info[0]).not.toBe(info[1]); // ron
    });
  });

  describe('ResultBlock', () => {
    it('should represent win result', () => {
      const result: ResultBlock = [
        '和了',
        [-2000, 6000, -2000, -2000],
        [1, 1, 1, '30符3飜2000点∀', '断幺九(1飜)'],
      ];
      expect(result[0]).toBe('和了');
    });

    it('should represent exhaustive draw', () => {
      const result: ResultBlock = ['流局', [1500, 1500, -1500, -1500]];
      expect(result[0]).toBe('流局');
    });

    it('should represent all tenpai', () => {
      const result: ResultBlock = ['全員聴牌'];
      expect(result.length).toBe(1);
    });
  });

  describe('RoundLog', () => {
    it('should have correct structure', () => {
      const log: RoundLog = [
        [0, 0, 0], // round info
        [25000, 25000, 25000, 25000], // starting points
        [37], // dora
        [], // ura dora
        // East
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24],
        [25],
        [11],
        // South
        [31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44],
        [45],
        [31],
        // West
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24],
        [26],
        [12],
        // North
        [31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44],
        [46],
        [32],
        // Result
        ['流局', [0, 0, 0, 0]],
      ];
      expect(log.length).toBe(17);
    });
  });

  describe('TenhouRule', () => {
    it('should accept shorthand aka', () => {
      const rule: TenhouRule = {
        disp: '般南喰赤',
        aka: 1,
      };
      expect(rule.aka).toBe(1);
    });

    it('should accept individual aka counts', () => {
      const rule: TenhouRule = {
        aka51: 1,
        aka52: 2,
        aka53: 0,
      };
      expect(rule.aka51).toBe(1);
      expect(rule.aka52).toBe(2);
      expect(rule.aka53).toBe(0);
    });
  });

  describe('GeneratorInput', () => {
    it('should have all required fields', () => {
      const input: GeneratorInput = {
        roundLog: [
          [0, 0, 0],
          [25000, 25000, 25000, 25000],
          [37],
          [],
          [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          ['流局', [0, 0, 0, 0]],
        ],
        playerEvents: [[], [], [], []],
        heroSeat: 0,
        rule: { aka: 1 },
      };
      expect(input.heroSeat).toBe(0);
      expect(input.playerEvents.length).toBe(4);
    });
  });

  describe('TenhouLogJson', () => {
    it('should have correct structure', () => {
      const log: TenhouLogJson = {
        title: ['牌谱屋', '2024/01/01 12:00 GMT'],
        name: ['東家', '南家', '西家', '北家'],
        rule: { disp: '般南喰赤', aka: 1 },
        log: [
          [
            [0, 0, 0],
            [25000, 25000, 25000, 25000],
            [37],
            [],
            [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24],
            [],
            [],
            [31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44],
            [],
            [],
            [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24],
            [],
            [],
            [31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44],
            [],
            [],
            ['流局', [0, 0, 0, 0]],
          ],
        ],
      };
      expect(log.title.length).toBe(2);
      expect(log.name.length).toBe(4);
      expect(log.log.length).toBe(1);
    });
  });
});

