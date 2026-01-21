// src/components/DebugPanel.tsx
import { useState } from 'react';
import { generate } from '../core/generator/LogGenerator';
import type { GeneratorInput, TenhouLogJson } from '../types';

/**
 * 创建测试输入：Hero 东家，手牌已知，其他未知
 */
function createTestInput(): GeneratorInput {
  // Hero 的起手 13 张
  const heroHaipai = [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24];

  return {
    roundLog: [
      [0, 0, 0], // 东1局 0本场 0供托
      [25000, 25000, 25000, 25000], // 起始点数
      [37], // 宝牌指示牌 7s
      [], // 里宝牌（无立直和了时为空）
      // 东家 (Hero) - 完整手牌，摸牌舍牌待补全
      heroHaipai, [null, null, null], [null, null, null],
      // 南家 - 全部待补全
      [], [null, null, null], [null, null, null],
      // 西家
      [], [null, null, null], [null, null, null],
      // 北家
      [], [null, null, null], [null, null, null],
      // 结果：流局
      ['流局', [0, 0, 0, 0]],
    ],
    playerEvents: [
      [], // 东家 (Hero) - 无事件
      [
        // 南家：吃 (来自上家)
        { type: 'CHI', callTarget: 12, callMelds: [11, 13], turn: 8 },
      ],
      [
        // 西家：碰 (来自任意一家)
        { type: 'PON', callTarget: 41, callMelds: [41, 41], turn: 9 },
      ],
      [
        // 北家：立直 (非自家)
        { type: 'RIICHI', discardTile: 17, turn: 10 },
      ],
    ],
    heroSeat: 0,
    rule: { aka: 1 },
  };
}

function toTenhouUrl(log: TenhouLogJson): string {
  return `https://tenhou.net/6/#json=${encodeURIComponent(JSON.stringify(log))}`;
}

export function DebugPanel() {
  const [result, setResult] = useState<TenhouLogJson | null>(null);

  const handleGenerate = () => {
    const input = createTestInput();
    const log = generate(input, {
      roomName: 'Debug Room',
      playerNames: ['Hero', 'CPU-1', 'CPU-2', 'CPU-3'],
    });
    setResult(log);
    console.log('Generated:', log);
  };

  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h2>🀄 Riichi Forge Debug</h2>

      <button
        onClick={handleGenerate}
        style={{ padding: '10px 20px', fontSize: 16, cursor: 'pointer' }}
      >
        生成测试牌谱
      </button>

      {result && (
        <div style={{ marginTop: 20 }}>
          <p>
            <a
              href={toTenhouUrl(result)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#4a9eff' }}
            >
              🔗 在 Tenhou 播放器中查看
            </a>
          </p>

          <details>
            <summary style={{ cursor: 'pointer' }}>查看 JSON</summary>
            <pre
              style={{
                background: '#1e1e1e',
                color: '#d4d4d4',
                padding: 12,
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 400,
                fontSize: 12,
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
