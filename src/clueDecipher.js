/**
 * @file clueDecipher.js
 * @description Manages Clue Decipher Mode state, character navigation, rendering, and letter propagation.
 *
 * What belongs here:
 * - Direction normalization helpers for clue keys.
 * - HTML generator converting clue text into interactive obscured character slots.
 * - Active character index tracking and linked character highlight synchronization.
 * - Character navigation (left/right arrows) and keystroke handling (letter entry, backspace).
 */

import { escape } from './utils.js';

/**
 * Normalizes direction representations (e.g. 0, 1, 'across', 'down', 'clues_0', 'clues_1')
 * to standard capitalized strings 'Across' or 'Down'.
 * @param {string|number} dir
 * @returns {'Across'|'Down'}
 */
export function normalizeDirection(dir) {
  if (dir === undefined || dir === null) return 'Across';
  const s = String(dir).toLowerCase();
  if (s === '1' || s === 'down' || s === 'clues_1') {
    return 'Down';
  }
  return 'Across';
}

/**
 * Formats clue text for rendering. In Clue Decipher Mode, wraps alphabetic characters
 * in interactive spans displaying either the entered letter or an obscuring block.
 * @param {string} clueText - Raw clue string.
 * @param {string|number} dir - Clue direction identifier.
 * @param {number|string} number - Clue number.
 * @returns {string} HTML string.
 */
export function getClueTextHtml(clueText, dir, number) {
  if (!this.isClueDecipherMode) {
    return escape(clueText);
  }
  let html = '';
  const originalText = clueText || '';
  const normalizedDir = this.normalizeDirection(dir);
  for (let idx = 0; idx < originalText.length; idx++) {
    const char = originalText[idx];
    if (/[a-zA-Z]/.test(char)) {
      const key = `${normalizedDir}-${number}-${idx}`;
      let userVal = this.clueLetterState ? this.clueLetterState[key] : null;
      if (userVal === null || userVal === undefined) {
        userVal = this.config.char_obscure || '▮';
      }
      html += `<span class="clue-char" data-clue-key="${key}">${escape(userVal)}</span>`;
    } else {
      html += escape(char);
    }
  }
  return html;
}

/**
 * Sets the initial cursor position within a clue to the first fillable alphabetical character.
 * @param {Word} word
 */
export function initActiveClueCharIndex(word) {
  if (!this.isClueDecipherMode || !word || !word.clue) return;
  const text = word.clue.text || '';
  for (let i = 0; i < text.length; i++) {
    if (/[a-zA-Z]/.test(text[i])) {
      this.activeClueCharIndex = i;
      return;
    }
  }
  this.activeClueCharIndex = 0;
}

/**
 * Updates DOM highlights for the active clue character (green) and all linked sibling characters (orange).
 */
export function updateClueHighlights() {
  if (!this.isClueDecipherMode) return;
  this.root.find('.clue-char-selected').removeClass('clue-char-selected');
  this.root.find('.clue-char-mapped').removeClass('clue-char-mapped');

  if (this.selected_word && this.activeClueCharIndex !== undefined) {
    const dir = this.normalizeDirection(this.selected_word.dir);
    const num = this.selected_word.clue?.number;
    const key = `${dir}-${num}-${this.activeClueCharIndex}`;

    this.root.find(`[data-clue-key="${key}"]`).addClass('clue-char-selected');

    const mappedKeys = (this.clueLetterLinkMap && this.clueLetterLinkMap[key]) || [];
    mappedKeys.forEach(siblingKey => {
      if (siblingKey !== key) {
        this.root.find(`[data-clue-key="${siblingKey}"]`).addClass('clue-char-mapped');
      }
    });
  }
}

/**
 * Advances or retreats active character cursor within the active clue, skipping punctuation and spaces.
 * @param {number} step - +1 (forward) or -1 (backward).
 */
export function moveClueCharSelection(step) {
  if (!this.isClueDecipherMode || !this.selected_word || !this.selected_word.clue) return;
  const text = this.selected_word.clue.text || '';
  let idx = this.activeClueCharIndex;
  if (idx === undefined) {
    this.initActiveClueCharIndex(this.selected_word);
    idx = this.activeClueCharIndex;
  }

  while (true) {
    idx += step;
    if (idx < 0 || idx >= text.length) {
      return;
    }
    if (/[a-zA-Z]/.test(text[idx])) {
      this.activeClueCharIndex = idx;
      this.updateClueHighlights();
      return;
    }
  }
}

/**
 * Inputs a letter into the currently selected clue character position and propagates it to all linked positions.
 * @param {string} char - Typed letter.
 */
export function typeClueChar(char) {
  if (!this.isClueDecipherMode || !this.selected_word || !this.selected_word.clue) return;
  if (this.activeClueCharIndex === undefined) return;
  const dir = this.normalizeDirection(this.selected_word.dir);
  const num = this.selected_word.clue.number;
  const activeKey = `${dir}-${num}-${this.activeClueCharIndex}`;

  const mappedKeys = (this.clueLetterLinkMap && this.clueLetterLinkMap[activeKey]) || [activeKey];
  mappedKeys.forEach(key => {
    const origChar = this.clueLetterOriginal ? this.clueLetterOriginal[key] : '';
    let finalChar = char;
    if (origChar) {
      const isUpper = (origChar === origChar.toUpperCase());
      finalChar = isUpper ? char.toUpperCase() : char.toLowerCase();
    }

    if (this.clueLetterState) {
      this.clueLetterState[key] = finalChar;
    }
    this.root.find(`[data-clue-key="${key}"]`).text(finalChar);
  });

  this.moveClueCharSelection(1);
  this.saveGame();
  this.checkIfSolved();
}

/**
 * Deletes character at current cursor position (or moves back and deletes) and propagates revert to linked coordinates.
 */
export function backspaceClueChar() {
  if (!this.isClueDecipherMode || !this.selected_word || !this.selected_word.clue) return;
  if (this.activeClueCharIndex === undefined) return;
  const dir = this.normalizeDirection(this.selected_word.dir);
  const num = this.selected_word.clue.number;
  const activeKey = `${dir}-${num}-${this.activeClueCharIndex}`;

  const currentVal = this.clueLetterState ? this.clueLetterState[activeKey] : null;
  const blockChar = this.config.char_obscure || '▮';

  if (currentVal !== null && currentVal !== undefined) {
    const mappedKeys = (this.clueLetterLinkMap && this.clueLetterLinkMap[activeKey]) || [activeKey];
    mappedKeys.forEach(key => {
      if (this.clueLetterState) {
        this.clueLetterState[key] = null;
      }
      this.root.find(`[data-clue-key="${key}"]`).text(blockChar);
    });
    this.updateClueHighlights();
  } else {
    this.moveClueCharSelection(-1);
    const newActiveKey = `${dir}-${num}-${this.activeClueCharIndex}`;
    const mappedKeys = (this.clueLetterLinkMap && this.clueLetterLinkMap[newActiveKey]) || [newActiveKey];
    mappedKeys.forEach(key => {
      if (this.clueLetterState) {
        this.clueLetterState[key] = null;
      }
      this.root.find(`[data-clue-key="${key}"]`).text(blockChar);
    });
    this.updateClueHighlights();
  }
  this.saveGame();
  this.checkIfSolved();
}
