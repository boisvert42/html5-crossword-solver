# The Three-Boddy Problem

This branch implements a specialized "multi-puzzle" mechanic for the puzzle titled **"The Three-Boddy Problem"**.

## Feature Overview

The core of this feature is the ability to swap out the bottom half of a crossword grid dynamically based on user input, while maintaining the top half and its progress.

- **Trigger Location**: Row 6, Column 4 (Cell 4, 6). This corresponds to the first letter of **19-Across**.
- **Triggers**: Typing one of the following letters in the trigger cell will load a different version of the bottom half of the puzzle:
    - **'N'**: Loads `MrGreen.ipuz`
    - **'S'**: Loads `Peacock.ipuz`
    - **'L'**: Loads `Scarlet.ipuz`

## Technical Details

The implementation resides primarily in `js/crosswords.js` and is activated when the puzzle title matches "The Three-Boddy Problem".

### Key Flags and Methods

- `isThreeBoddy`: Boolean flag that enables the TBP logic.
- `isThreeBoddyRevealed`: Tracks if a variant has been loaded.
- `threeBoddySolvedStatus`: Object tracking the completion state (`true`/`false`) of the 'N', 'S', and 'L' variants.
- `initThreeBoddy()`: Initializes the TBP state, loads saved progress/status from `localStorage`, and pre-fetches all variant files.
- `isBottomHalfWord(word)`: Helper to determine if a word belongs to the bottom half (Row > 6).
- `isBottomHalfCell(x, y)`: Helper to determine if a cell is in the bottom half.
- `revealThreeBoddy(letter)`: The main logic for swapping variants:
    1. Saves current progress for the entire grid.
    2. Specifically saves bottom-half progress for the *current* variant to `threeBoddyProgress`.
    3. Re-parses the crossword using the new IPUZ data.
    4. Restores the top-half progress.
    5. Restores the bottom-half progress if switching back to a previously visited variant.
    6. Re-renders the grid and clues and triggers a save.

## Completion & Rewards

The puzzle tracks the completion of each of the three variants individually.

- **Persistence**: Progress and completion status are saved to `localStorage` under the keys `[savegame_name]_threeBoddyProgress` and `[savegame_name]_threeBoddySolvedStatus`.
- **Conditional Messaging**: When the puzzle is solved, the completion message depends on the number of variants completed:
    - **1 or 2 Variants**: Shows the message: *"That's how it could have happened ..."*
    - **All 3 Variants**: Shows the full **"explanation"** from the metadata, revealing the final secret of the puzzle.

### Files

- `tbp.html`: The entry point for this puzzle. It forces the load of the initial TBP file.
- `three_boddy_problem_files/`:
    - `MrGreen.ipuz`: Default variant (Trigger 'N').
    - `Peacock.ipuz`: Variant (Trigger 'S').
    - `Scarlet.ipuz`: Variant (Trigger 'L').
    - `grid.png`: Reference image of the grid.

## Interaction

1. Load `tbp.html`.
2. Initially, only the clues and cells for the top half (Rows 1-6) are fully functional/visible in the top bar.
3. Once you reach the trigger cell (4, 6) and type 'N', 'S', or 'L', the bottom half of the grid will populate with the corresponding variant's clues and layout.
4. You can switch between variants at any time by changing the letter in the trigger cell. Progress in each variant's bottom half is preserved individually.
