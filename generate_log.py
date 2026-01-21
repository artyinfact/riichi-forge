import json
import random
import os

# ============== Global Variables ==============

# Game info
TITLE = ["令和版 現代麻雀 押し引きの教科書", "Q003"]
NAMES = ["Aさん", "Bさん", "Cさん", "Dさん"]
RULE = {"disp": "般南喰赤", "aka": 1}

# Round info
ROUND = 0       # 0=East1, 1=East2, ..., 4=South1, ...
HONBA = 0       # number of repeat counters
RIICHI_STICKS = 0

# Initial scores
SCORES = [25000, 25000, 25000, 25000]

# Dora indicators (the revealed tile, dora is the next tile)
DORA_INDICATOR = [21]
URA_DORA_INDICATOR = []

# Hero (self) settings
HERO_SEAT = "NORTH"  # "EAST", "SOUTH", "WEST", "NORTH"
HERO_HAND = [13, 14, 17, 18, 19, 25, 26, 27, 28, 28, 31, 31, 33]  # 13 tiles
HERO_LAST_DRAW = 32 
HERO_LAST_DISCARD = 31 # Hero's last discard (hand-cut, not tsumogiri)
HERO_LAST_DISCARD_TURN = 8  # which turn (巡目) hero hand-cuts

# Hero's last action type (what happens on hero's final turn)
# "DISCARD" - normal discard (default)
# "RIICHI"  - riichi declaration with discard (立直)
# "CHI"     - chi from kami, then discard (吃)
# "PON"     - pon, then discard (碰)
# "KAN"     - open kan, then rinshan draw, then discard (明杠)
# "ANKAN"   - closed kan, then rinshan draw, then discard (暗杠)
HERO_LAST_ACTION = "RIICHI"

# For CHI (吃): specify the called tile and two tiles from hand
# Example: chi 2s(32) with 1s(31) and 3s(33) → HERO_CALL_TILE=32, HERO_CHI_TILES=[31,33]
HERO_CALL_TILE = 0      # The tile being called (for chi/pon/kan)
HERO_CHI_TILES = []     # Two tiles from hand forming sequence with called tile

# For PON (碰): specify source player
# "KAMI" (上家), "TOIMEN" (対家), "SHIMO" (下家)
HERO_PON_SOURCE = "KAMI"

# For KAN (明杠): specify source player
# "KAMI" (上家), "TOIMEN" (対家), "SHIMO" (下家)  
HERO_KAN_SOURCE = "KAMI"

# For ANKAN (暗杠): uses HERO_CALL_TILE as the tile type (all 4 from hand)

# ============== Other Players' Actions ==============
# Configuration for SHIMO (下家), TOIMEN (対家), KAMI (上家)
# RIICHI_TURN: 0 = no riichi, >0 = riichi on that turn (tsumogiri riichi only)
# Future: CHI, PON, KAN actions will be added here

OTHER_PLAYERS_ACTIONS = {
    "SHIMO": {
        "RIICHI_TURN": 5,   # 0=不立直, >0=在该巡目摸切立直
    },
    "TOIMEN": {
        "RIICHI_TURN": 0,
    },
    "KAMI": {
        "RIICHI_TURN": 0,
    },
}

# All players' draws (relative position)
# HERO: self
# SHIMO (下家): next player after hero, wins by tsumo (last tile must be 45)
# TOIMEN (対家): player across from hero
# KAMI (上家): player before hero
DRAWS = {
    "HERO": [],
    "SHIMO": [],  
    "TOIMEN": [],
    "KAMI": [],
}

# Result
RESULT_TYPE = "和了"
RESULT_INFO = [1, 1, 0, "天地創造"]  # [fu_marker, tsumo(1)/ron(0), riichi(1/0), yaku]

# SCORE_CHANGES is calculated automatically based on HERO_SEAT
# Winner is always SHIMO (下家 = player after hero)
# If HERO_SEAT = "NORTH", SHIMO is EAST (dealer), 48000 ALL tsumo → [144000, -48000, -48000, -48000]
# Otherwise, SHIMO is non-dealer: winner +96000, dealer -48000, others -24000
def calculate_score_changes():
    seats = ["EAST", "SOUTH", "WEST", "NORTH"]
    hero_idx = seats.index(HERO_SEAT)
    shimo_idx = (hero_idx + 1) % 4  # Winner (下家)
    dealer_idx = 0  # EAST is dealer in round 0
    
    if shimo_idx == dealer_idx:
        # Dealer tsumo: 48000 ALL
        return [144000, -48000, -48000, -48000]
    else:
        # Non-dealer tsumo: dealer pays 48000, others pay 24000
        changes = [0, 0, 0, 0]
        changes[shimo_idx] = 96000  # Winner
        for i in range(4):
            if i == shimo_idx:
                continue
            elif i == dealer_idx:
                changes[i] = -48000  # Dealer pays more
            else:
                changes[i] = -24000  # Non-dealer
        return changes

SCORE_CHANGES = calculate_score_changes()

# ============== Call Notation Generation ==============

def generate_call_notation(action, tile, source=None, chi_tiles=None):
    """
    Generate tenhou log call notation string.
    
    Format reference:
    - 吃 (chi): "c" prefix on called tile, e.g., "吃213m" → "c121113"
    - 碰 (pon): "p" position indicates source
      - 上家: "碰888s" → "p383838" (p first)
      - 対家: "8碰88s" → "38p3838" (p second)
      - 下家: "88碰8s" → "3838p38" (p third)
    - 杠 (kan): "m" position indicates source
      - 上家: "杠8888s" → "m38383838" (m first)
      - 対家: "8杠888s" → "38m383838" (m second)  
      - 下家: "888杠8s" → "383838m38" (m fourth)
    - 暗杠 (ankan): "a" at 4th position, e.g., "888暗8s" → "383838a38"
    """
    t = str(tile)
    
    if action == "CHI":
        # Chi always from kami (上家)
        # Sort tiles to get sequence order, prefix 'c' to called tile
        all_tiles = sorted(chi_tiles + [tile])
        result = ""
        for tt in all_tiles:
            if tt == tile:
                result += f"c{tt}"
            else:
                result += str(tt)
        return result
    
    elif action == "PON":
        # Position of 'p' indicates source: 1st=kami, 2nd=toimen, 3rd=shimo
        if source == "KAMI":
            return f"p{t}{t}{t}"
        elif source == "TOIMEN":
            return f"{t}p{t}{t}"
        else:  # SHIMO
            return f"{t}{t}p{t}"
    
    elif action == "KAN":
        # Position of 'm' indicates source: 1st=kami, 2nd=toimen, 4th=shimo
        if source == "KAMI":
            return f"m{t}{t}{t}{t}"
        elif source == "TOIMEN":
            return f"{t}m{t}{t}{t}"
        else:  # SHIMO
            return f"{t}{t}{t}m{t}"
    
    elif action == "ANKAN":
        # Closed kan - 'a' at 4th position
        return f"{t}{t}{t}a{t}"
    
    return t


# ============== Random Draw Generation ==============

def generate_random_draws():
    """
    Generate random draws when DRAWS values are empty.
    
    Pool: 4 copies each of 11-19, 21-29, 31-39, 41-47
    If RULE["aka"]==1: one each of 15,25,35 replaced with red fives 51,52,53
    Subtract: HERO_HAND, HERO_LAST_DRAW, DORA_INDICATOR, discards as they happen
    
    Turn restrictions:
    - Turns 1-3: Only terminals (11,19,21,29,31,39) and honors (41-47)
    - Turns 4-5: Add 2s and 8s (12,18,22,28,32,38)
    - Turn 6+: Add 3s and 7s (13,17,23,27,33,37)
    - Turn 7+: Add middle tiles (14,15,16,24,25,26,34,35,36) and red fives (51,52,53)
    """
    
    # Build initial pool (4 copies of each tile)
    pool = []
    for suit in [10, 20, 30]:  # manzu, pinzu, souzu
        for num in range(1, 10):
            pool.extend([suit + num] * 4)
    for honor in range(41, 48):  # honors
        pool.extend([honor] * 4)
    
    # Handle red fives (aka dora) if RULE["aka"] == 1
    # Replace one each of 15, 25, 35 with 51, 52, 53
    if RULE.get("aka") == 1:
        for normal, red in [(15, 51), (25, 52), (35, 53)]:
            if normal in pool:
                pool.remove(normal)
                pool.append(red)
    
    # Remove HERO_HAND tiles from pool
    for tile in HERO_HAND:
        if tile in pool:
            pool.remove(tile)
    
    # Remove HERO_LAST_DRAW from pool (will place it manually at correct position)
    if HERO_LAST_DRAW in pool:
        pool.remove(HERO_LAST_DRAW)
    
    # Remove DORA_INDICATOR tiles from pool
    for tile in DORA_INDICATOR:
        if tile in pool:
            pool.remove(tile)
    
    # Define tile categories for turn restrictions
    terminals = {11, 19, 21, 29, 31, 39}
    honors = set(range(41, 48))
    twos_eights = {12, 18, 22, 28, 32, 38}
    threes_sevens = {13, 17, 23, 27, 33, 37}
    middle = {14, 15, 16, 24, 25, 26, 34, 35, 36, 51, 52, 53}  # includes red fives
    
    def get_allowed_tiles(turn):
        """Get set of tile types allowed for given turn (1-indexed)."""
        allowed = terminals | honors
        if turn >= 4:
            allowed |= twos_eights
        if turn >= 6:
            allowed |= threes_sevens
        if turn >= 7:
            allowed |= middle
        return allowed
    
    def draw_random_tile(pool, turn):
        """Draw a random tile from pool respecting turn restrictions."""
        allowed = get_allowed_tiles(turn)
        available = [t for t in pool if t in allowed]
        if not available:
            available = pool[:]  # Fallback if no valid tiles left
        if not available:
            raise ValueError("No tiles left in pool!")
        tile = random.choice(available)
        pool.remove(tile)
        return tile
    
    # Setup
    n = HERO_LAST_DISCARD_TURN
    seats = ["EAST", "SOUTH", "WEST", "NORTH"]
    hero_idx = seats.index(HERO_SEAT)
    
    # Map absolute seat index to relative position
    abs_to_pos = {
        hero_idx: "HERO",
        (hero_idx + 1) % 4: "SHIMO",
        (hero_idx + 2) % 4: "TOIMEN",
        (hero_idx + 3) % 4: "KAMI",
    }
    
    # Initialize draws and turn counters
    draws = {"HERO": [], "SHIMO": [], "TOIMEN": [], "KAMI": []}
    player_turns = {"HERO": 0, "SHIMO": 0, "TOIMEN": 0, "KAMI": 0}
    
    # Simulate n full rounds of draws (EAST -> SOUTH -> WEST -> NORTH per round)
    for round_num in range(n):
        for seat_idx in range(4):
            pos = abs_to_pos[seat_idx]
            player_turns[pos] += 1
            turn = player_turns[pos]
            
            if pos == "HERO" and turn == n:
                # Hero's last draw is HERO_LAST_DRAW
                draws["HERO"].append(HERO_LAST_DRAW)
            else:
                tile = draw_random_tile(pool, turn)
                draws[pos].append(tile)
    
    # SHIMO draws once more for tsumo win - always 45 (白) to end the game
    draws["SHIMO"].append(45)
    
    return draws


def get_draws():
    """Return DRAWS dict, generating random draws if all values are empty."""
    if all(not DRAWS[pos] for pos in ["HERO", "SHIMO", "TOIMEN", "KAMI"]):
        return generate_random_draws()
    return DRAWS


# ============== Build Log ==============

def build_other_player_discards(rel_pos, num_discards):
    """
    Build discards array for other players (SHIMO, TOIMEN, KAMI).
    
    Handles riichi declaration if configured in OTHER_PLAYERS_ACTIONS.
    Other players only do tsumogiri riichi (摸切立直): 'r60' format.
    
    Args:
        rel_pos: Relative position ("SHIMO", "TOIMEN", "KAMI")
        num_discards: Total number of discards for this player
        
    Returns:
        List of discards with riichi notation if applicable
    """
    if rel_pos not in OTHER_PLAYERS_ACTIONS:
        return [60] * num_discards
    
    riichi_turn = OTHER_PLAYERS_ACTIONS[rel_pos].get("RIICHI_TURN", 0)
    
    # RIICHI_TURN: 0 = no riichi, >0 = riichi on that turn
    if riichi_turn <= 0 or riichi_turn > num_discards:
        return [60] * num_discards
    
    # Build discards with tsumogiri riichi
    discards = []
    for turn in range(1, num_discards + 1):
        if turn == riichi_turn:
            discards.append("r60")  # 摸切立直
        else:
            discards.append(60)
    
    return discards


def build_player_data():
    """
    Generate 4 players' [hand, draws, discards] based on HERO_SEAT.
    
    Relative positions:
    - HERO: self (main player)
    - SHIMO (下家): next player, wins by tsumo
    - TOIMEN (対家): across
    - KAMI (上家): previous player
    
    Turn order: EAST(0) -> SOUTH(1) -> WEST(2) -> NORTH(3) -> EAST(0)...
    
    Action types:
    - DISCARD: normal hand-cut discard
    - RIICHI: riichi declaration (prefix 'r' to discard)
    - CHI: chi from kami, replaces last draw with call notation
    - PON: pon from source, replaces last draw with call notation
    - KAN: open kan, replaces last draw with call notation, adds rinshan draw
    - ANKAN: closed kan, replaces last draw with call notation, adds rinshan draw
    """
    # Get draws (may be randomly generated if DRAWS is empty)
    current_draws = get_draws()
    
    seats = ["EAST", "SOUTH", "WEST", "NORTH"]
    hero_idx = seats.index(HERO_SEAT)
    
    # Map relative positions to absolute indices
    pos_map = {
        hero_idx: "HERO",
        (hero_idx + 1) % 4: "SHIMO",  # 下家 (winner)
        (hero_idx + 2) % 4: "TOIMEN", # 対家
        (hero_idx + 3) % 4: "KAMI",   # 上家
    }
    
    n = len(current_draws["HERO"])  # hero's draw count = full rounds
    default_hand = [45] * 13
    
    # Generate call notation if needed
    call_notation = None
    if HERO_LAST_ACTION == "CHI":
        call_notation = generate_call_notation("CHI", HERO_CALL_TILE, chi_tiles=HERO_CHI_TILES)
    elif HERO_LAST_ACTION == "PON":
        call_notation = generate_call_notation("PON", HERO_CALL_TILE, source=HERO_PON_SOURCE)
    elif HERO_LAST_ACTION == "KAN":
        call_notation = generate_call_notation("KAN", HERO_CALL_TILE, source=HERO_KAN_SOURCE)
    elif HERO_LAST_ACTION == "ANKAN":
        call_notation = generate_call_notation("ANKAN", HERO_CALL_TILE)
    
    result = []
    for i in range(4):
        rel_pos = pos_map[i]
        # Players 0~hero: n rounds, players after hero: n-1 rounds
        full_rounds = n if i <= hero_idx else n - 1
        
        if rel_pos == "HERO":
            # Hero: real hand, handle different action types
            hand = HERO_HAND
            draws = list(current_draws["HERO"])  # Make a copy
            
            if HERO_LAST_ACTION == "DISCARD":
                # Normal discard
                discards = [60] * (HERO_LAST_DISCARD_TURN - 1) + [HERO_LAST_DISCARD]
                
            elif HERO_LAST_ACTION == "RIICHI":
                # Riichi declaration - prefix 'r' to discard
                discards = [60] * (HERO_LAST_DISCARD_TURN - 1) + [f"r{HERO_LAST_DISCARD}"]
                
            elif HERO_LAST_ACTION == "CHI":
                # Chi from kami - replace last draw with call notation
                draws[-1] = call_notation
                discards = [60] * (HERO_LAST_DISCARD_TURN - 1) + [HERO_LAST_DISCARD]
                
            elif HERO_LAST_ACTION == "PON":
                # Pon - replace last draw with call notation
                draws[-1] = call_notation
                discards = [60] * (HERO_LAST_DISCARD_TURN - 1) + [HERO_LAST_DISCARD]
                
            elif HERO_LAST_ACTION in ["KAN", "ANKAN"]:
                # Kan - replace last draw with call notation
                # After kan, draw rinshan tile (HERO_LAST_DRAW), then discard
                draws[-1] = call_notation
                draws.append(HERO_LAST_DRAW)  # Rinshan draw
                discards = [60] * (HERO_LAST_DISCARD_TURN - 1) + [HERO_LAST_DISCARD]
            else:
                discards = [60] * (HERO_LAST_DISCARD_TURN - 1) + [HERO_LAST_DISCARD]
                
        elif rel_pos == "SHIMO":
            # Shimo (winner): no discard on last draw
            hand = default_hand
            draws = list(current_draws["SHIMO"])
            discards = build_other_player_discards(rel_pos, full_rounds)
        else:
            # Toimen, Kami: handle riichi if configured
            hand = default_hand
            draws = list(current_draws[rel_pos])
            discards = build_other_player_discards(rel_pos, full_rounds)
        
        result.extend([hand, draws, discards])
    
    return result

player_data = build_player_data()

log = {
    "title": TITLE,
    "name": NAMES,
    "rule": RULE,
    "log": [
        [
            [ROUND, HONBA, RIICHI_STICKS],
            SCORES,
            DORA_INDICATOR,
            URA_DORA_INDICATOR,
            *player_data,
            [RESULT_TYPE, SCORE_CHANGES, RESULT_INFO]
        ]
    ]
}

# ============== Output ==============

def format_log_json(data):
    """Format JSON with log array items on separate lines"""
    lines = ['{']
    lines.append(f'  "title": {json.dumps(data["title"], ensure_ascii=False)},')
    lines.append(f'  "name": {json.dumps(data["name"], ensure_ascii=False)},')
    lines.append(f'  "rule": {json.dumps(data["rule"], ensure_ascii=False)},')
    lines.append('  "log": [')
    lines.append('    [')
    
    log_items = data["log"][0]
    for i, item in enumerate(log_items):
        comma = ',' if i < len(log_items) - 1 else ''
        lines.append(f'      {json.dumps(item, ensure_ascii=False)}{comma}')
    
    lines.append('    ]')
    lines.append('  ]')
    lines.append('}')
    return '\n'.join(lines)

# Create output folder based on TITLE[0], filename based on TITLE[1]
output_folder = TITLE[0] if TITLE[0] else "output"
output_filename = f"{TITLE[1]}.json" if TITLE[1] else "log.json"
output_path = os.path.join(output_folder, output_filename)

# Create folder if it doesn't exist
os.makedirs(output_folder, exist_ok=True)

with open(output_path, "w", encoding="utf-8") as f:
    f.write(format_log_json(log))

print(f"Output: {output_path}")
