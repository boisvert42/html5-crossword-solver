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

    # 3. Check for odd numbers of each letter (warn but allow)
    odd_letters = {}
    for letter, coords in letter_coords.items():
        if len(coords) % 2 != 0:
            odd_letters[letter] = len(coords)

    if odd_letters:
        print("⚠️ Warning: Some letters have an odd count across all clues.")
        print("The script will create a triplet group (3-way link) for the odd remainder.")
        for letter, count in sorted(odd_letters.items()):
            print(f"  '{letter.upper()}': {count} occurrences")
    else:
        print("✅ All letters have even counts. Generating pairwise mappings...")

    # 4. Generate mappings
    clue_letter_mappings = []
    
    for letter, coords in sorted(letter_coords.items()):
        n = len(coords)
        if n == 0:
            continue
        
        # Shuffle to randomize
        random.shuffle(coords)
        
        # If n is odd, try to extract a triplet first
        triplet = []
        if n % 2 != 0:
            if n == 1:
                # Standalone letter, error out
                print(f"❌ Error: Letter '{letter.upper()}' has only 1 occurrence across all clues. It must cross with at least one other clue (minimum 2 occurrences).")
                return False
            
            # Find 3 coordinates from different clues
            found_triplet = False
            for _ in range(50):
                random.shuffle(coords)
                # Try to pick first 3 from different clues
                if (coords[0]["dir"], coords[0]["num"]) != (coords[1]["dir"], coords[1]["num"]) and \
                   (coords[0]["dir"], coords[0]["num"]) != (coords[2]["dir"], coords[2]["num"]) and \
                   (coords[1]["dir"], coords[1]["num"]) != (coords[2]["dir"], coords[2]["num"]):
                    triplet = [coords.pop(0), coords.pop(0), coords.pop(0)]
                    clue_letter_mappings.append(triplet)
                    found_triplet = True
                    break
            
            if not found_triplet:
                # Just pop any 3
                triplet = [coords.pop(), coords.pop(), coords.pop()]
                clue_letter_mappings.append(triplet)
                print(f"⚠️ Warning: For letter '{letter.upper()}', could not find 3 occurrences in completely different clues. Linked within same clue.")

        # Now coords has an even number of elements. Pair them up!
        # Simple greedy pairing with backtracking if we hit a self-clue match at the end
        unpaired = coords.copy()
        attempts = 0
        
        while attempts < 100 and unpaired:
            attempts += 1
            pairs = []
            temp_unpaired = unpaired.copy()
            random.shuffle(temp_unpaired)
            
            success = True
            while temp_unpaired:
                c1 = temp_unpaired.pop()
                # Find a c2 in a different clue
                c2_idx = -1
                for i, c in enumerate(temp_unpaired):
                    if (c["dir"], c["num"]) != (c1["dir"], c1["num"]):
                        c2_idx = i
                        break
                
                if c2_idx != -1:
                    c2 = temp_unpaired.pop(c2_idx)
                    pairs.append([c1, c2])
                else:
                    success = False
                    break
            
            if success:
                clue_letter_mappings.extend(pairs)
                break
        else:
            if unpaired:
                # Fallback: just pair remaining coordinates without different-clue constraint
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
