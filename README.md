# Riichi Forge 🀄

**逆向麻雀牌谱生成器** - 一个用于生成和补全 Tenhou 格式牌谱的工具。

## 简介

Riichi Forge 是一个基于 TypeScript 构建的麻雀牌谱生成工具，可以：

- 🧩 **补全残缺牌谱**：给定 Hero 的手牌和部分已知信息，自动补全对手的摸牌/舍牌
- 🎯 **脚本化副露**：预设玩家的吃/碰/杠/立直行为，生成器会在合适的时机触发
- ✅ **输入验证**：严格的类型检查和数据验证，确保生成的牌谱格式正确
- 🔗 **Tenhou 兼容**：输出标准的 Tenhou JSON 格式，可直接在 [Tenhou 播放器](https://tenhou.net/6/) 中回放

## 技术栈

- **React 19** + **TypeScript 5.9** + **Vite 7**
- **Vitest** 单元测试

## 项目结构

```
src/
├── types/
│   └── index.ts              # 核心类型定义（TileId, RoundLog, TenhouLogJson 等）
├── utils/
│   ├── tile.ts               # 牌工具函数（赤牌处理、洗牌、排序）
│   └── validator.ts          # 输入验证（牌ID、副露字符串、RoundLog 结构）
├── core/
│   ├── solver/
│   │   └── NaiveSolver.ts    # 牌谱补全求解器
│   └── generator/
│       └── LogGenerator.ts   # Tenhou JSON 生成器
├── scripts/
│   ├── index.ts              # 脚本入口
│   └── completeLog.ts        # CLI 补全工具
└── components/
    └── DebugPanel.tsx        # 调试用 React 组件
```

## 核心概念

### 牌 ID 编码 (TileId)

```
数牌: 11-19 (萬), 21-29 (筒), 31-39 (索)
字牌: 41-47 (東南西北白發中)
赤牌: 51 (赤5m), 52 (赤5p), 53 (赤5s)
```

### 舍牌优先级 (NaiveSolver)

求解器在补全对手舍牌时，按以下优先级选择：

1. **现物** - 立直家的舍牌 + 立直后所有人的舍牌
2. **字牌** - 41-47
3. **老头牌** - 1/9
4. **28** - 2/8
5. **37** - 3/7
6. **中张** - 4/5/6

### Tenhou Log 格式

一个完整的 `RoundLog` 包含 17 个元素：

```typescript
[
  [round, honba, riichi_sticks],  // 场次信息
  [east_pts, south_pts, ...],    // 起始点数
  [dora_indicators],              // 宝牌指示牌
  [ura_dora_indicators],          // 里宝牌
  // 四家数据 (各 3 个元素)
  haipai_0, draws_0, discards_0,  // 东家
  haipai_1, draws_1, discards_1,  // 南家
  haipai_2, draws_2, discards_2,  // 西家
  haipai_3, draws_3, discards_3,  // 北家
  result                          // 结果
]
```

## 使用方法

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### CLI 工具

补全残缺牌谱：

```bash
# 从文件读取
npx ts-node src/scripts/completeLog.ts input.json output.json

# 从标准输入读取
cat input.json | npx ts-node src/scripts/completeLog.ts --stdin --pretty

# 生成 Tenhou 播放器 URL
npx ts-node src/scripts/completeLog.ts --url input.json
```

### 输入格式 (GeneratorInput)

```typescript
{
  "roundLog": [...],  // RoundLog 结构，未知位置填 null
  "playerEvents": [   // 四家的预设事件
    [],               // 东家事件
    [                 // 南家事件
      { "type": "PON", "callTarget": 15 }
    ],
    [],               // 西家事件
    []                // 北家事件
  ],
  "heroSeat": 0,      // Hero 座位 (0-3)
  "rule": {
    "aka": 1          // 每种花色的赤牌数量
  }
}
```

### 脚本化事件 (PlayerEvent)

支持的事件类型：

| 类型 | 说明 | 必需字段 |
|------|------|----------|
| `CHI` | 吃 | `callTarget`, `callMelds` |
| `PON` | 碰 | `callTarget` |
| `MINKAN` | 明杠 | `callTarget` |
| `ANKAN` | 暗杠 | `callMelds` (4张) |
| `KAKAN` | 加杠 | `callTarget` |
| `RIICHI` | 立直 | `discardTile` |

## API 示例

```typescript
import { generate, generateJson } from './core/generator/LogGenerator';
import type { GeneratorInput } from './types';

const input: GeneratorInput = {
  roundLog: [
    [0, 0, 0],                    // 东1局 0本场
    [25000, 25000, 25000, 25000], // 起始点数
    [15],                         // 宝牌指示牌 5m
    [],                           // 无里宝牌
    // Hero (东家) 的完整信息
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 41, 41, 42, 42], // 手牌
    [21, 22, 23],                 // 已知摸牌
    [11, 60, 42],                 // 已知舍牌 (60 = 摸切)
    // 对手留空，由 Solver 补全
    [], [], [],                   // 南家
    [], [], [],                   // 西家
    [], [], [],                   // 北家
    ['流局', [0, 0, 0, 0]]        // 结果
  ],
  playerEvents: [[], [], [], []], // 无预设事件
  heroSeat: 0,
  rule: { aka: 1 }
};

// 生成完整的 TenhouLogJson
const result = generate(input);

// 或直接生成 JSON 字符串
const json = generateJson(input, {}, true);  // pretty = true
```

## 开发

### 运行测试

```bash
npm test
```

### 构建

```bash
npm run build
```

### 代码检查

```bash
npm run lint
```

## 许可证

MIT
