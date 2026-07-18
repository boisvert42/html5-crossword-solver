# Clue Decipher Mode (Obscured Clues / "Crossing Words" Simulation)

This document describes the design and technical requirements for the **Clue Decipher Mode**, a specialized puzzle mode where the grid is pre-solved, and the gameplay revolves around decrypting and reconstructing the clues.

---

## 1. Core Concept

In a standard crossword, you read clear clues to fill in a blank grid. In **Clue Decipher Mode**, the relationship is inverted:
*   **The Grid:** Starts completely filled with the correct solution.
*   **The Clues:** All alphabetical letters in the clues are initially replaced by an obscuring symbol (e.g., `▮`). Punctuation, numbers, and spaces remain visible to preserve clue structure.
*   **The Goal:** The player reconstructs the text of the clues by typing letters into them.
*   **Crossing Letters:** To simulate the "crossing" nature of a crossword, typing a letter in one clue automatically fills in the corresponding mapped letter in other clues.

---

## 2. Gameplay & User Interaction

### Navigation
*   **Grid Navigation:** Clicking grid cells or using vertical navigation/entry-based navigation works as normal to select active words/clues.
*   **Clue Character Navigation:** 
    *   When a clue is active, the left and right arrow keys navigate the selection cursor *horizontally through the individual characters of the active clue*, rather than navigating the grid.
    *   The cursor skips spaces and punctuation, only landing on fillable letter slots.
*   **Active Clue Cursor:** The active clue must display a cursor or highlight showing the specific character slot currently being edited.

### Highlights & Colors
To make the letter crossings intuitive, we use the following color cues in the clues area:
*   **Selected Letter (Green):** The currently selected character slot in the active clue is colored **green**.
*   **Corresponding Letters (Orange):** All linked character slots (any that will auto-populate when the selected letter is typed) are highlighted in **orange**.

### Input
*   When a clue (or its grid entry) is active, typing a letter inputs it into the currently selected character slot of that clue.
*   Typing a letter:
    1.  Replaces the obscure character `▮` at the cursor position with the typed letter.
    2.  Checks the mapping system to find all linked character positions in other clues.
    3.  Instantly updates all linked character positions with the same typed letter.
    4.  Advances the cursor to the next fillable character in the active clue.
*   **Backspace/Delete:** Clears the current character and all its linked characters, reverting them to `▮`.

---

## 3. iPuz File Format Extension

To support this mode, the input `iPuz` JSON file needs to specify the mappings between characters in different clues. We use an **absolute index** mapping approach.

We propose adding a custom metadata field, `clue_letter_mappings`, or an extension within the `clues` structure.

### Proposed Structure: Coordinate-Based Links
Each character in every clue is addressable by a coordinate: `[clue_direction, clue_number, character_index]`. 

We can define groups of linked coordinates. For example:

```json
{
  "origin": "Crossword Nexus Custom Solver",
  "version": "http://ipuz.org/v2",
  "kind": [ "http://ipuz.org/ext/clue-decipher" ],
  "grid": [ ... ],
  "clues": {
    "Across": [
      [1, "Obscured clue text here"],
      [4, "Another clue text"]
    ],
    "Down": [
      [1, "Down clue text"],
      [2, "Yet another down clue"]
    ]
  },
  "clue_letter_mappings": [
    [
      {"dir": "Across", "num": 1, "idx": 0},
      {"dir": "Down", "num": 1, "idx": 3}
    ],
    [
      {"dir": "Across", "num": 1, "idx": 1},
      {"dir": "Across", "num": 4, "idx": 2},
      {"dir": "Down", "num": 2, "idx": 0}
    ]
  ]
}
```

*   `idx` refers to the **absolute 0-indexed position** of the character in the clue string (including spaces and punctuation).
*   All coordinates within the same array group are linked. Entering a letter at any of these coordinates propagates that letter to all other coordinates in the group.

---

## 4. Implementation Steps in the Solver

1.  **Detection:**
    *   Detect if the loaded iPuz file contains the custom kind `http://ipuz.org/ext/clue-decipher` or the `clue_letter_mappings` key.
2.  **Grid Initialization:**
    *   Pre-populate the entire grid with the solution letters immediately upon load. Make grid cells read-only or disable typing direct letters into grid cells (redirecting keypresses to the active clue instead).
3.  **Clue Obscuring:**
    *   Store the original clue texts in memory.
    *   Generate a parallel state array for the current user-entered clue letters, initialized to `▮` for letters, while preserving spaces and punctuation.
4.  **UI Updates:**
    *   Render the clues using the user-entered states, displaying each character (or letter slot) as an individual HTML element (e.g., `<span>` or `<rect>`) to allow precise targeting, styling, and cursors.
    *   Apply custom styling class names for active selection (**green**) and cross-linked cells (**orange**).
5.  **Event Handling:**
    *   Capture keyboard input when an entry/clue is focused.
    *   Intercept left/right arrow keys to navigate clue characters.
    *   Update the state for the active slot and its mapped coordinates when a letter is pressed.
    *   Re-render/update the clues to display the newly revealed letters.

---

## 5. Performance Optimization & Data Structures

To prevent slow input responsiveness, we must avoid searching the global mapping array on every keystroke. Instead, the solver will pre-index the connections on puzzle load.

### 5.1 The Letter Link Lookup Map
During initialization, compile the mappings array into a dictionary:

```javascript
// A lookup map stored on the CrossWord instance
this.clueLetterLinkMap = {}; 

// Example populated structure:
// {
//   "Across-1-0": ["Down-1-3", "Across-1-0"],
//   "Down-1-3": ["Across-1-0", "Down-1-3"],
//   "Across-1-1": ["Across-1-1", "Across-4-2", "Down-2-0"]
// }
```

*   **Key Generation:** `${dir}-${num}-${idx}`
*   **Keystroke Logic ($O(1)$ Complexity):**
    1. Look up the key of the active character.
    2. Retrieve the linked list of coordinates.
    3. Update the value for all elements in that list.

### 5.2 Direct DOM Targeting
To keep typing extremely snappy and avoid full DOM re-renders of the clue list:
*   Identify each clue letter slot using data attributes: `<span data-clue-key="Across-1-0" class="clue-char">▮</span>`.
*   When a state change occurs, select the DOM elements directly using their data attributes:
    ```javascript
    const targets = document.querySelectorAll(`[data-clue-key="${key}"]`);
    targets.forEach(el => {
      el.textContent = typedChar;
    });
    ```
*   Update active/crossing highlights in the same manner. This avoids re-rendering the surrounding text, labels, or unrelated clues.

