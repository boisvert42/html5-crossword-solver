#!/usr/bin/env python3
import json
import sys
import random
from collections import defaultdict

def parse_clue_num(num):
    """Safely parse a clue number into an integer for proximity calculations."""
    if isinstance(num, (int, float)):
        return int(num)
    if isinstance(num, str):
        digits = ''.join(ch for ch in num if ch.isdigit())
        if digits:
            return int(digits)
    return 0

def clue_distance(c1, c2, same_clue_penalty=20):
    """
    Cost formula based on proximity:
    cost = (difference in clue numbers) + 3 * (boolean if different clue list) + 20 * (same clue penalty)
    """
    diff_num = abs(parse_clue_num(c1["num"]) - parse_clue_num(c2["num"]))
    diff_list = 1 if c1["dir"] != c2["dir"] else 0
    same_clue = 1 if (c1["dir"] == c2["dir"] and c1["num"] == c2["num"]) else 0
    
    # Tie-breaker: prefer closer character index positions if all else is equal
    tie_breaker = 0.0001 * abs(c1["idx"] - c2["idx"])
    
    return diff_num + (3 * diff_list) + (same_clue_penalty * same_clue) + tie_breaker

def triplet_cost(a, b, c, same_clue_penalty=20):
    """Sum of pairwise distances in a triplet."""
    return (clue_distance(a, b, same_clue_penalty) +
            clue_distance(b, c, same_clue_penalty) +
            clue_distance(a, c, same_clue_penalty))

def pair_coordinates(coords, same_clue_penalty=20):
    """
    Pairs an even number of coordinates to minimize total distance.
    Uses greedy matching followed by 2-opt edge swap optimization.
    """
    n = len(coords)
    if n == 0:
        return []
    if n == 2:
        return [[coords[0], coords[1]]]
    
    all_pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            d = clue_distance(coords[i], coords[j], same_clue_penalty)
            all_pairs.append((d, i, j))
            
    best_matching = None
    best_total_cost = float('inf')
    
    num_restarts = 5 if n > 4 else 1
    for run in range(num_restarts):
        if run == 0:
            candidate_pairs = sorted(all_pairs, key=lambda x: x[0])
        else:
            candidate_pairs = sorted(all_pairs, key=lambda x: x[0] + random.uniform(0, 0.5))
            
        matched = set()
        current_pairs = []
        for d, i, j in candidate_pairs:
            if i not in matched and j not in matched:
                matched.add(i)
                matched.add(j)
                current_pairs.append([i, j])
                if len(matched) == n:
                    break
                    
        # 2-opt swap passes
        for _ in range(50):
            improved = False
            for p1 in range(len(current_pairs)):
                for p2 in range(p1 + 1, len(current_pairs)):
                    a, b = current_pairs[p1]
                    c, d = current_pairs[p2]
                    
                    cost_curr = clue_distance(coords[a], coords[b], same_clue_penalty) + clue_distance(coords[c], coords[d], same_clue_penalty)
                    cost_swap1 = clue_distance(coords[a], coords[c], same_clue_penalty) + clue_distance(coords[b], coords[d], same_clue_penalty)
                    cost_swap2 = clue_distance(coords[a], coords[d], same_clue_penalty) + clue_distance(coords[b], coords[c], same_clue_penalty)
                    
                    min_cost = min(cost_curr, cost_swap1, cost_swap2)
                    if min_cost < cost_curr - 1e-6:
                        if min_cost == cost_swap1:
                            current_pairs[p1] = [a, c]
                            current_pairs[p2] = [b, d]
                        else:
                            current_pairs[p1] = [a, d]
                            current_pairs[p2] = [b, c]
                        improved = True
                        break
                if improved:
                    continue
                break
                
        total_cost = sum(clue_distance(coords[i], coords[j], same_clue_penalty) for i, j in current_pairs)
        if total_cost < best_total_cost:
            best_total_cost = total_cost
            best_matching = current_pairs
            
    return [[coords[i], coords[j]] for i, j in best_matching]

def analyze_and_map_clues(ipuz_path, output_path=None, same_clue_penalty=20):
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
        
        if n == 1:
            print(f"❌ Error: Letter '{letter.upper()}' has only 1 occurrence across all clues. It must cross with at least one other clue (minimum 2 occurrences).")
            return False
            
        coords_pool = list(coords)
        
        # If n is odd, find the best triplet to minimize overall distance
        if n % 2 != 0:
            if n == 3:
                clue_letter_mappings.append(coords_pool)
                coords_pool = []
            else:
                # Find candidate triplets
                candidate_triplets = []
                for i in range(n):
                    for j in range(i + 1, n):
                        for k in range(j + 1, n):
                            t_cost = triplet_cost(coords_pool[i], coords_pool[j], coords_pool[k], same_clue_penalty)
                            candidate_triplets.append((t_cost, i, j, k))
                
                candidate_triplets.sort(key=lambda x: x[0])
                
                # Evaluate top candidate triplets by total cost (triplet + paired remainder)
                best_triplet = None
                best_remainder_pairs = None
                best_combined_cost = float('inf')
                
                # Check up to 10 best candidate triplets
                for t_cost, i, j, k in candidate_triplets[:10]:
                    triplet = [coords_pool[i], coords_pool[j], coords_pool[k]]
                    remainder = [coords_pool[m] for m in range(n) if m not in (i, j, k)]
                    pairs = pair_coordinates(remainder, same_clue_penalty)
                    rem_cost = sum(clue_distance(p[0], p[1], same_clue_penalty) for p in pairs)
                    
                    if t_cost + rem_cost < best_combined_cost:
                        best_combined_cost = t_cost + rem_cost
                        best_triplet = triplet
                        best_remainder_pairs = pairs
                        
                clue_letter_mappings.append(best_triplet)
                clue_letter_mappings.extend(best_remainder_pairs)
                coords_pool = []
                
        # If coords_pool still has coordinates (even n)
        if coords_pool:
            pairs = pair_coordinates(coords_pool, same_clue_penalty)
            clue_letter_mappings.extend(pairs)

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
