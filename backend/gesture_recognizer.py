import math

def distance_3d(p1, p2):
    """Euclidean distance between two 3D points [x, y, z]."""
    return math.sqrt(
        (p1[0] - p2[0]) ** 2 +
        (p1[1] - p2[1]) ** 2 +
        (p1[2] - p2[2]) ** 2
    )

def normalize_landmarks(landmarks):
    """
    Normalizes 21 MediaPipe hand landmarks relative to the wrist (landmark 0),
    scaled by the palm size (distance from wrist to middle finger MCP).
    """
    if not landmarks or len(landmarks) < 21:
        return None

    wrist = landmarks[0]
    # Landmark 9 is Middle Finger MCP
    middle_mcp = landmarks[9]
    scale = distance_3d(wrist, middle_mcp)
    if scale == 0:
        scale = 1.0

    normalized = []
    for pt in landmarks:
        normalized.append([
            (pt[0] - wrist[0]) / scale,
            (pt[1] - wrist[1]) / scale,
            (pt[2] - wrist[2]) / scale
        ])
    return normalized

def classify_gesture_from_landmarks(landmarks):
    """
    Rule-based robust landmark classifier for 21 MediaPipe hand points.
    Returns: dict(gesture=str, confidence=float, label=str)
    """
    norm = normalize_landmarks(landmarks)
    if not norm:
        return {"gesture": None, "confidence": 0.0, "label": "No Hand"}

    # Landmark indices
    # Wrist: 0
    # Thumb: 1, 2, 3, 4 (tip)
    # Index: 5, 6, 7, 8 (tip)
    # Middle: 9, 10, 11, 12 (tip)
    # Ring: 13, 14, 15, 16 (tip)
    # Pinky: 17, 18, 19, 20 (tip)

    wrist = norm[0]
    thumb_tip, thumb_ip, thumb_mcp = norm[4], norm[3], norm[2]
    index_tip, index_pip, index_mcp = norm[8], norm[6], norm[5]
    middle_tip, middle_pip, middle_mcp = norm[12], norm[10], norm[9]
    ring_tip, ring_pip, ring_mcp = norm[16], norm[14], norm[13]
    pinky_tip, pinky_pip, pinky_mcp = norm[20], norm[18], norm[17]

    # Finger extension logic:
    # A finger is extended if its TIP distance to wrist is significantly greater than PIP to wrist
    index_extended = distance_3d(index_tip, wrist) > distance_3d(index_pip, wrist) * 1.15
    middle_extended = distance_3d(middle_tip, wrist) > distance_3d(middle_pip, wrist) * 1.15
    ring_extended = distance_3d(ring_tip, wrist) > distance_3d(ring_pip, wrist) * 1.15
    pinky_extended = distance_3d(pinky_tip, wrist) > distance_3d(pinky_pip, wrist) * 1.15

    # Thumb extension: tip distance to pinky_mcp vs ip distance to pinky_mcp
    thumb_extended = distance_3d(thumb_tip, pinky_mcp) > distance_3d(thumb_ip, pinky_mcp) * 1.2
    
    # Distance between thumb tip and other finger tips (for pinch / ok)
    dist_thumb_index = distance_3d(thumb_tip, index_tip)
    dist_thumb_middle = distance_3d(thumb_tip, middle_tip)

    # 1. OKAY Sign: Thumb and Index tips close, Middle, Ring, Pinky extended
    if dist_thumb_index < 0.35 and middle_extended and ring_extended and pinky_extended:
        return {"gesture": "OKAY", "confidence": 0.94, "label": "Okay / Perfect"}

    # 2. I LOVE YOU (ILY): Thumb, Index, Pinky extended; Middle and Ring curled
    if thumb_extended and index_extended and not middle_extended and not ring_extended and pinky_extended:
        return {"gesture": "LOVE", "confidence": 0.96, "label": "I Love You (ILY)"}

    # 3. PEACE / VICTORY: Index and Middle extended in V shape, others curled
    if index_extended and middle_extended and not ring_extended and not pinky_extended:
        # Distance between index tip and middle tip to ensure separation
        v_spread = distance_3d(index_tip, middle_tip)
        if v_spread > 0.3:
            return {"gesture": "PEACE", "confidence": 0.95, "label": "Peace / Victory"}
        else:
            return {"gesture": "U", "confidence": 0.88, "label": "Letter U"}

    # 4. THUMBS UP / GOOD: Thumb points upwards, other 4 fingers curled
    if thumb_extended and not index_extended and not middle_extended and not ring_extended and not pinky_extended:
        # Check if thumb tip is higher than thumb mcp (note: in screen coordinates, smaller y is higher)
        if thumb_tip[1] < thumb_mcp[1]:
            return {"gesture": "GOOD", "confidence": 0.95, "label": "Good / Thumbs Up"}
        elif thumb_tip[1] > thumb_mcp[1]:
            return {"gesture": "BAD", "confidence": 0.92, "label": "Bad / Thumbs Down"}
        else:
            return {"gesture": "A", "confidence": 0.85, "label": "Letter A"}

    # 5. LETTER L: Thumb and Index extended at approximately 90 degrees, others curled
    if thumb_extended and index_extended and not middle_extended and not ring_extended and not pinky_extended:
        return {"gesture": "L", "confidence": 0.93, "label": "Letter L"}

    # 6. LETTER Y / CALL ME: Thumb and Pinky extended, middle 3 curled
    if thumb_extended and not index_extended and not middle_extended and not ring_extended and pinky_extended:
        return {"gesture": "Y", "confidence": 0.94, "label": "Letter Y / Call Me"}

    # 7. LETTER I: Only Pinky extended, other 4 curled
    if not thumb_extended and not index_extended and not middle_extended and not ring_extended and pinky_extended:
        return {"gesture": "I", "confidence": 0.92, "label": "Letter I"}

    # 8. POINT / YOU: Only Index extended
    if not thumb_extended and index_extended and not middle_extended and not ring_extended and not pinky_extended:
        return {"gesture": "YOU", "confidence": 0.92, "label": "You / Pointing"}

    # 9. LETTER W / THREE: Index, Middle, Ring extended; Pinky and Thumb curled
    if index_extended and middle_extended and ring_extended and not pinky_extended:
        return {"gesture": "W", "confidence": 0.90, "label": "Letter W / Three"}

    # 10. HELLO / OPEN PALM / STOP: All 5 fingers extended and spread
    if thumb_extended and index_extended and middle_extended and ring_extended and pinky_extended:
        return {"gesture": "HELLO", "confidence": 0.96, "label": "Hello / Open Hand"}

    # 11. LETTER B: 4 fingers extended straight together, thumb folded across palm
    if not thumb_extended and index_extended and middle_extended and ring_extended and pinky_extended:
        return {"gesture": "B", "confidence": 0.91, "label": "Letter B / Thank You"}

    # 12. YES / FIST: All 5 fingers curled into a fist
    if not thumb_extended and not index_extended and not middle_extended and not ring_extended and not pinky_extended:
        return {"gesture": "YES", "confidence": 0.89, "label": "Yes / Fist"}

    # 13. NO / PINCH: Thumb, Index, Middle pinch together
    if dist_thumb_index < 0.4 and dist_thumb_middle < 0.4 and not ring_extended and not pinky_extended:
        return {"gesture": "NO", "confidence": 0.88, "label": "No"}

    # 14. LETTER C: Curved fingers
    if not index_extended and not pinky_extended:
        if 0.35 < dist_thumb_index < 0.7:
            return {"gesture": "C", "confidence": 0.82, "label": "Letter C"}

    return {"gesture": "RECOGNIZING", "confidence": 0.50, "label": "Analyzing..."}
