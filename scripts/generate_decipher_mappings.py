#!/usr/bin/env python3
import json
import sys
import random
from collections import defaultdict

def analyze_and_map_clues(ipuz_path, output_path=None):
    with open(ipuz_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 1. Gather all clues and trace their characters
    clues_list = [] # stores (dir, num, text)
    if 'clues' in data:
        for direction in ['Across', 'Down']:
            if direction in data['clues']:
                for entry in data['clues'][direction]:
                    # iPuz clues can be [number, clue_text] or a dict
                    if isinstance(entry, list) and len(entry) >= 2:
                        num = entry[0]
                        text = entry[1]
                    elif isinstance(entry, dict):
                        num = entry.get('number')
                        text = entry.get('clue')
                    else:
                        continue
                    clues_list.append((direction, num, text))

    # 2. Count letter occurrences and gather coordinates
    # letter_coords['a'] = [(dir, num, char_index), ...]
    letter_coords = defaultdict(list)
    for direction, num, text in clues_list:
        for idx, char in enumerate(text):
            if char.isalpha():
                letter_coords[char.lower()].append({
                    "dir": direction,
                    "num": num,
                    "idx": idx
                })

    # 3. Check for even numbers of each letter
    odd_letters = {}
    for letter, coords in letter_coords.items():
        if len(coords) % 2 != 0:
            odd_letters[letter] = len(coords)

    if odd_letters:
        print("❌ Error: Some letters do not have an even count across all clues.")
        print("Please edit the clue wording to balance the counts.")
        print("\nOdd letter counts:")
        for letter, count in sorted(odd_letters.items()):
            print(f"  '{letter.upper()}': {count} occurrences")
        
        print("\nOccurrences of odd letters in clues:")
        for direction, num, text in clues_list:
            found = [c.upper() for c in text if c.lower() in odd_letters]
            if found:
                print(f"  {direction} {num}: \"{text}\" -> contains {found}")
        return False

    print("✅ All letters have even counts. Generating pairwise mappings...")

    # 4. Generate pairwise mappings (simulating crossword intersections)
    clue_letter_mappings = []
    
    for letter, coords in sorted(letter_coords.items()):
        # Shuffle coordinates to randomize the pairing
        # We want to pair coords such that they belong to different clues
        random.shuffle(coords)
        
        # Try to pair up coordinates
        # Simple greedy pairing with backtracking if we hit a self-clue match at the end
        pairs = []
        unpaired = coords.copy()
        
        attempts = 0
        while unpaired and attempts < 100:
            attempts += 1
            pairs = []
            temp_unpaired = unpaired.copy()
            random.shuffle(temp_unpaired)
            
            success = True
            while temp_unpaired:
                if len(temp_unpaired) < 2:
                    success = False
                    break
                
                c1 = temp_unpaired.pop()
                # Find a c2 that is in a different clue
                c2_idx = -1
                for i, c in enumerate(temp_unpaired):
                    if (c["dir"], c["num"]) != (c1["dir"], c1["num"]):
                        c2_idx = i
                        break
                
                if c2_idx != -1:
                    c2 = temp_unpaired.pop(c2_idx)
                    pairs.append([c1, c2])
                else:
                    # Could not find a different clue partner
                    success = False
                    break
            
            if success:
                clue_letter_mappings.extend(pairs)
                break
        else:
            # If greedy random pairing fails to find different-clue match, just pair them as is
            # (Warning the user)
            print(f"⚠️ Warning: Had to pair some '{letter.upper()}' letters within the same clue due to matching constraints.")
            temp_unpaired = coords.copy()
            while len(temp_unpaired) >= 2:
                clue_letter_mappings.append([temp_unpaired.pop(), temp_unpaired.pop()])

    data['clue_letter_mappings'] = clue_letter_mappings
    
    # Add custom kind identifier if not present
    if 'kind' not in data:
        data['kind'] = []
    kind_ext = "http://ipuz.org/ext/clue-decipher"
    if kind_ext not in data['kind']:
        data['kind'].append(kind_ext)

    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"🎉 Successfully wrote updated iPuz with mappings to: {output_path}")
    else:
        print(json.dumps(data, indent=2))
        
    return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 generate_decipher_mappings.py <input.ipuz> [output.ipuz]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file
    
    analyze_and_map_clues(input_file, output_file)
