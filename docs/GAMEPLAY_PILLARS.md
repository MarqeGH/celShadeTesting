# Gameplay Pillars

## Pillar 1: Readable but Oppressive Combat

### What It Means
Every enemy telegraphs every attack through shape transformation, color shift, or motion wind-up. The player always has enough information to react — but the reaction window is tight and the punishment for failure is severe. Combat is fair but unforgiving.

### Implementation Impact
- All enemy attacks require a visible `telegraph` phase (minimum 300ms) before the `active` phase
- Telegraphs are expressed through geometry: shapes expand, rotate, glow, or extend before striking
- Attack hitboxes activate ONLY during the `active` window — never during telegraph or recovery
- Damage numbers and screen shake provide clear feedback on both giving and receiving damage
- Audio cues must accompany every telegraph for accessibility

### Anti-Patterns to Avoid
- Attacks that activate without visual warning
- Damage that comes from off-screen enemies the player can't see
- Hit detection that doesn't match visual geometry
- Enemies that animation-cancel out of recovery into new attacks
- Stun-locking the player with no escape window

---

## Pillar 2: Ontological Horror Through Design

### What It Means
The world communicates its horror through what things *are*, not through exposition. A triangle enemy doesn't need a backstory — its behavior, movement, and death animation should imply it was once something more. Environments feel wrong because they're *almost* recognizable. The horror is in the reduction.

### Implementation Impact
- No dialogue, no text logs, no narrators — lore is spatial and behavioral
- Enemy death effects should hint at former complexity (brief particle burst of more complex shapes)
- Environments should contain vestigial human elements (a door frame with no wall, a staircase to nothing)
- Color palettes should feel drained or shifted — never saturated or warm
- Sound design: ambient drones, resonant hums, absence of organic sounds

### Anti-Patterns to Avoid
- Exposition dumps or text-heavy lore delivery
- Jump scares or shock horror
- Cute or comedic tone breaking (no comic relief enemies)
- Over-explaining why shapes exist
- Making shapes feel like "monster designs" instead of "collapsed humans"

---

## Pillar 3: Modular Ecosystem Design

### What It Means
Every game element (enemy, room, encounter, weapon, hazard) is a composable data-driven unit. Content creation means adding JSON files and potentially new behavior classes. The system supports combinatorial variety without requiring unique code for every piece of content.

### Implementation Impact
- Enemies are defined by data files + behavior class references — new enemies require minimal code
- Rooms are assembled from module definitions (geometry + spawn points + exit connections)
- Encounters are data: enemy type list + spawn timing + room constraints
- Weapons are data: damage, speed, range, attack pattern references
- All tuning values live in data files or config, not hardcoded in logic

### Anti-Patterns to Avoid
- Hardcoding enemy stats in class files
- Creating unique room classes instead of data-driven assembly
- Coupling encounter logic to specific room geometry
- Making weapon behavior impossible to express in data
- Requiring code changes to add new content

---

## Pillar 4: Stamina-Pressure Gameplay

### What It Means
Every player action costs a resource. Attacking, dodging, blocking, and sprinting all drain stamina. The player is always managing a depleting resource under threat. This creates moment-to-moment tension: *can I afford to attack again, or do I need to back off?*

### Implementation Impact
- Stamina system with visible bar, fast drain, medium-speed regen
- Stamina regen pauses briefly after any stamina-spending action
- Running out of stamina leaves the player vulnerable (slower movement, no dodge)
- Enemy attack patterns must have windows where the player can safely regen
- Stamina costs must be tunable per weapon and per action

### Anti-Patterns to Avoid
- Infinite stamina or stamina that regens so fast it doesn't matter
- Stamina costs so high that the player can only act twice before exhaustion
- No recovery windows in enemy attack patterns
- Making stamina irrelevant by providing too many stamina-restore items
- Heal-spamming that bypasses the resource pressure loop

---

## Pillar 5: Repetition with Variation

### What It Means
As a roguelike, runs share structural DNA but differ in specifics. The player learns *systems* across runs, not *layouts*. Enemy behavior is consistent; room arrangements change. Weapon properties are stable; which weapons appear varies. Mastery comes from understanding the grammar of the game, not memorizing a map.

### Implementation Impact
- Room modules are shuffled per run but drawn from themed pools per zone
- Encounter composition varies but respects difficulty curves per zone depth
- Weapon drops are randomized from the unlock pool
- Boss fights have fixed movesets but appear in varying arena configurations
- Meta-progression unlocks expand the variety pool, not player power directly

### Anti-Patterns to Avoid
- Runs that feel identical because the pool is too small
- Pure randomness with no difficulty scaling
- Progression that makes the player so powerful that challenge disappears
- Runs so long that death feels devastating instead of motivating
- Randomizing enemy behavior — enemies must be learnable
