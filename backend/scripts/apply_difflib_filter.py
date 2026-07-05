import sys

file_path = "/Users/satyaviswas/Documents/sift-recovery-engine/backend/memory_bridge.py"

with open(file_path, "r") as f:
    content = f.read()

# 1. Add is_forbidden at the top after imports
if "def is_forbidden" not in content:
    import_index = content.find("import json")
    
    function_code = """
import difflib
import re

def is_forbidden(text, forbidden_topics):
    if not forbidden_topics:
        return False
    text_lower = text.lower()
    text_words = re.findall(r'\\b\\w+\\b', text_lower)
    text_words.extend([text_words[i] + text_words[i+1] for i in range(len(text_words)-1) if i < len(text_words)-1])
    
    stop_words = {"i", "liked", "playing", "the", "a", "an", "and", "or", "but", "really", "loved", "yesterday", "today", "tomorrow", "this", "that", "was", "is", "am", "are", "were"}
    
    for topic in forbidden_topics:
        # direct exact match
        if topic in text_lower:
            return True
            
        sig_words = [w for w in re.findall(r'\\b\\w+\\b', topic) if len(w) >= 4 and w not in stop_words]
        if sig_words:
            sig_compound = "".join(sig_words)
            sig_words.append(sig_compound)
            
            has_sig = False
            for word in sig_words:
                for lw in text_words:
                    if len(lw) >= 4:
                        if difflib.SequenceMatcher(None, word, lw).ratio() > 0.80:
                            has_sig = True
                            break
                if has_sig: break
                
            if has_sig:
                return True
                
    return False
"""
    # Just insert it after import json
    lines = content.split('\\n')
    for i, line in enumerate(lines):
        if line.startswith("import json"):
            lines.insert(i+1, function_code)
            break
    content = "\\n".join(lines)

# 2. Update process_context in /api/recover
old_process_context = """                    # Strict text filtering
                    if any(forbid in item_str.lower() for forbid in forbidden_entities):
                        continue"""

new_process_context = """                    # Aggressive True Semantic Output Filter
                    if is_forbidden(item_str, forbidden_entities):
                        continue"""

content = content.replace(old_process_context, new_process_context)

# 3. Update filtered_full_timeline in /api/recover
old_timeline_filter = """        if req.full_history:
            for item in req.full_history.split('\\n'):
                if not any(forbid in item.lower() for forbid in forbidden_entities):
                    filtered_full_timeline.append(item)"""

new_timeline_filter = """        if req.full_history:
            for item in req.full_history.split('\\n'):
                if not is_forbidden(item, forbidden_entities):
                    filtered_full_timeline.append(item)"""

content = content.replace(old_timeline_filter, new_timeline_filter)

# 4. Update _generate_blindspots_logic process_context
old_blindspots_filter = """                    if any(forbid in item_str.lower() for forbid in forbidden_entities):
                        continue"""
new_blindspots_filter = """                    if is_forbidden(item_str, forbidden_entities):
                        continue"""
                        
content = content.replace(old_blindspots_filter, new_blindspots_filter)


with open(file_path, "w") as f:
    f.write(content)
print("Updated memory_bridge.py successfully.")
