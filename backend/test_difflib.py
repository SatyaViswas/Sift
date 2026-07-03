import difflib
import re

topic = "I liked playing pickel ball"
stop_words = {"i", "liked", "playing", "the", "a", "an", "and", "or", "but", "really", "loved", "yesterday", "today", "tomorrow", "this", "that"}
sig_words = [w for w in re.findall(r'\b\w+\b', topic.lower()) if len(w) >= 4 and w not in stop_words]

# Also create a concatenated version of sig words for compound words
sig_compound = "".join(sig_words)
sig_words.append(sig_compound)

line = "While you enjoy pickleball, existing data logs focus exclusively on beach volleyball as a 'focus catalyst.'"
line_words = re.findall(r'\b\w+\b', line.lower())
line_words.extend([line_words[i] + line_words[i+1] for i in range(len(line_words)-1)]) # add adjacent pairs

has_sig = False
for word in sig_words:
    for lw in line_words:
        if len(lw) >= 4:
            ratio = difflib.SequenceMatcher(None, word, lw).ratio()
            if ratio > 0.75:
                print(f"Match found! '{word}' is similar to '{lw}' (Ratio: {ratio:.2f})")
                has_sig = True
                break
    if has_sig: break

if has_sig:
    print("Line DROPPED")
else:
    print("Line KEPT")
