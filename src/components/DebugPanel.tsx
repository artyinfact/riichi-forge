// src/components/DebugPanel.tsx
import { useState } from 'react';
import { generate } from '../core/generator/LogGenerator';
import type { GeneratorInput, TenhouLogJson } from '../types';
import { ConfigPanel } from './ConfigPanel';

function toTenhouUrl(log: TenhouLogJson): string {
  return `https://tenhou.net/6/#json=${encodeURIComponent(JSON.stringify(log))}`;
}

export function DebugPanel() {
  const [result, setResult] = useState<TenhouLogJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = (input: GeneratorInput) => {
    try {
      setError(null);
      const log = generate(input, {
        roomName: 'Riichi Forge',
        playerNames: ['Hero', 'CPU-1', 'CPU-2', 'CPU-3'],
      });
      setResult(log);
      console.log('Generated:', log);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      console.error('Generation error:', e);
    }
  };

  return (
    <div style={{ 
      padding: 20, 
      fontFamily: 'monospace',
      maxWidth: 900,
      margin: '0 auto',
    }}>
      <h2 style={{ color: '#fff', marginTop: 0 }}>Riichi Forge</h2>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Left: Config panel */}
        <div style={{ flex: '1 1 400px', minWidth: 350 }}>
          <ConfigPanel onGenerate={handleGenerate} />
        </div>

        {/* Right: Result panel */}
        <div style={{ flex: '1 1 400px', minWidth: 350 }}>
          <h3 style={{ color: '#fff', marginTop: 0 }}>Generated Result</h3>

          {error && (
            <div style={{
              padding: 12,
              background: '#422',
              border: '1px solid #833',
              borderRadius: 4,
              color: '#faa',
              marginBottom: 12,
            }}>
              Error: {error}
            </div>
          )}

          {result && (
            <div>
              <p>
                <a
                  href={toTenhouUrl(result)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    color: '#4a9eff',
                    fontSize: 16,
                    fontWeight: 'bold',
                  }}
                >
                  View in Tenhou Player
                </a>
              </p>

              <details open>
                <summary style={{ cursor: 'pointer', color: '#aaa', marginBottom: 8 }}>
                  View JSON
                </summary>
                <pre
                  style={{
                    background: '#1e1e1e',
                    color: '#d4d4d4',
                    padding: 12,
                    borderRadius: 4,
                    overflow: 'auto',
                    maxHeight: 500,
                    fontSize: 11,
                    border: '1px solid #444',
                  }}
                >
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {!result && !error && (
            <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>
              Configure parameters and click "Generate Log"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
