# Player & Combat Spec

## Player Verbs

### Movement Verbs
| Verb | Description | Stamina Cost | State |
|------|-------------|-------------|-------|
| **Walk** | Default movement. Camera-relative direction. | 0 | `run` |
| **Sprint** | Faster movement. Hold sprint button. | 3/s | `run` (sprint flag) |
| **Dodge** | Quick directional roll with i-frames. | 20 | `dodge` |
| **Jump** | Not included. This is a grounded combat game. | — | — |

### Combat Verbs
| Verb | Description | Stamina Cost | State |
|------|-------------|-------------|-------|
| **Light Attack** | Fast swing. 2-hit combo on repeat press. | 12 per swing | `light_attack` |
| **Heavy Attack** | Slow charged swing. Hold + release. | 25 | `heavy_attack` |
| **Parry** | Precise timing deflection. Small window. | 8 | `parry` |
| **Heal** | Consume heal charge. Brief animation. Interruptible by damage. | 0 | `heal` |

### Movement Details
- **Base walk speed**: 5 m/s
- **Sprint speed**: 8 m/s
- **Dodge distance**: 4m over 300ms
- **Dodge i-frames**: frames 50ms–250ms of dodge (200ms window)
- **Movement is camera-relative**: forward = direction camera faces
- **Lock-on movement**: becomes strafe-relative (circle target)

---

## Resource Systems

### Health (HP)
- **Base**: 100
- **Display**: red bar, top-left HUD
- **Regen**: none — healing is active only
- **Death**: HP ≤ 0 → death state → run ends

### Stamina
- **Base**: 100
- **Drain**: per action (see verb table)
- **Regen**: 25/s after 400ms pause (pause resets on any stamina-spending action)
- **Exhaustion**: at 0 stamina, cannot dodge/attack/sprint. Walk speed reduced to 3 m/s. Lasts until stamina reaches 20.
- **Display**: green bar below HP bar

### Heal Charges
- **Per run start**: 3
- **Heal amount**: 35 HP per charge
- **Heal time**: 800ms animation (can be interrupted by taking damage)
- **Refill**: shrines between rooms restore 1 charge

---

## Dodge / Parry Mechanics

### Dodge
- **Input**: dodge button + directional input
- **Duration**: 300ms total
- **I-frame window**: 50ms–250ms (200ms of invulnerability)
- **Recovery**: 100ms after dodge ends before next action
- **Stamina**: 20
- **Cooldown**: none (stamina-gated)

### Parry
- **Input**: parry button (tap, not hold)
- **Window**: 150ms from button press
- **On success**: attacker is staggered for 1s, player recovers 10 stamina, next attack deals 1.5x damage
- **On failure (mistimed)**: player takes full damage + 200ms extra stagger
- **Stamina**: 8 (spent on attempt regardless of success)

### No Block
- There is no passive block/shield. Defense is active: dodge or parry. This keeps combat aggressive and skill-based.

---

## Weapon Assumptions

### Weapon Slots
- 1 weapon equipped at a time (can carry up to 2, swap with button)
- Weapons are found during runs (random from unlock pool)
- Starting weapon: always available, medium stats

### Weapon Properties
| Property | Description |
|----------|-------------|
| `baseDamage` | Raw damage per light hit |
| `heavyMultiplier` | Multiplier for heavy attack damage |
| `attackSpeed` | Speed modifier (1.0 = normal) |
| `range` | Hitbox reach in meters |
| `staggerDamage` | Poise damage per hit |
| `comboHits` | Number of hits in light combo chain |
| `staminaCostLight` | Stamina per light attack |
| `staminaCostHeavy` | Stamina per heavy attack |

### Starting Weapon: Fracture Blade
| Property | Value |
|----------|-------|
| baseDamage | 18 |
| heavyMultiplier | 2.0 |
| attackSpeed | 1.0 |
| range | 2.5m |
| staggerDamage | 15 |
| comboHits | 2 |
| staminaCostLight | 12 |
| staminaCostHeavy | 25 |

---

## Healing Assumptions

- Heal charges are limited per run (start: 3, max: 5 with upgrades)
- Healing is an active animation (800ms) — NOT instant
- Taking damage during heal animation cancels the heal (charge is NOT consumed on cancel)
- Shrines between rooms restore 1 heal charge
- No passive HP regen
- No lifesteal (unless granted by rare run upgrade)

---

## Death / Retry Loop

1. HP reaches 0
2. Death animation plays (player shape fragments into particles, 1.5s)
3. Death screen shows: rooms cleared, enemies killed, shards collected
4. Shards collected during run are split: 50% kept as meta-currency, 50% lost
5. Player returns to hub
6. Hub: spend meta-currency on permanent unlocks
7. Start new run

---

## Roguelike Progression

### Per-Run (Reset on Death)
- Current HP and stamina
- Equipped weapons (1–2)
- Active buffs/fragments collected this run
- Heal charges remaining
- Current zone and room position
- Shard count (run currency)

### Meta-Progression (Permanent)
- Unlocked weapons (expand drop pool)
- Unlocked abilities (expand player options)
- Permanent stat bonuses (small, capped)
- Lore echoes collected (collectible, no gameplay effect)
- Zones unlocked (progress deeper)

### Design Constraint
Meta-progression should expand **variety**, not **power**. A player with 100 runs should have more options, not be 3x stronger. Cap permanent stat bonuses at +20% max.

---

## Combat Principles

### Pacing
- Encounters should alternate intensity: hard room → breather → hard room → boss
- Individual fights should last 10–30s for basic enemies, 60–120s for elites/bosses
- Recovery windows between enemy attacks: minimum 500ms for basic enemies, 300ms for elites
- Runs should take 15–25 minutes (5–8 rooms)

### Punishment
- Getting hit should always feel significant (15–30% HP for standard attacks)
- Greed (attacking without stamina awareness) is punished by exhaustion state
- Mistimed parries are punished harder than just dodging
- No attack should one-shot from full HP (except optional boss enrage moves)

### Telegraph Clarity
- Every enemy attack has a visible wind-up phase (minimum 300ms)
- Telegraphs use consistent visual language:
  - **Red glow** = melee incoming
  - **Orange glow** = ranged incoming
  - **White flash** = unblockable / grab
- Audio cues accompany every telegraph
- Hitboxes match visual geometry — no phantom range

### Crowd Management
- Encounters should use 2–5 enemies maximum simultaneously
- Mixed compositions force prioritization (kill ranged first? or clear melee?)
- Enemy aggro is staggered — not all enemies attack simultaneously
- Maximum 2 enemies actively attacking at once; others orbit/reposition

### Stamina / Resource Pressure
- Light attack chain (2 hits) costs 24 stamina = ~25% of pool
- Dodge costs 20 stamina = 20% of pool
- Full aggression (2 attacks + dodge) = 44 stamina → forces regen pause
- Player should always be asking: "can I afford one more action?"

### Lock-On Expectations
- Lock-on snaps camera focus to target enemy
- Player movement becomes strafe-relative (circle-strafe)
- Attacks auto-orient toward locked target
- Target switching: flick right stick / mouse while locked
- Lock-on range: 15m — auto-drops if target exits range
- Lock-on persists through dodge
- No lock-on required — unlocked play should be viable
