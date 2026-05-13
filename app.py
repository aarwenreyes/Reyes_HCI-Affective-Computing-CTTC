import base64
import os
import numpy as np
from flask import Flask, render_template, jsonify, request

# ── Try loading cv2 ──────────────────────────────────────────
try:
    import cv2
    CV2_LOADED = True
except Exception as e:
    CV2_LOADED = False
    print(f"[WARN] Could not load cv2: {e}")

# ── Try loading Keras/TF model ──────────────────────────────
try:
    from keras.models import load_model
    model = load_model('model.hdf5', compile=False)
    MODEL_LOADED = True
    print("[INFO] Emotion model loaded successfully.")
except Exception as e:
    model = None
    MODEL_LOADED = False
    print(f"[WARN] Could not load model: {e}. Emotion detection disabled.")

# ── Load face detector ───────────────────────────────────────
try:
    face_cascade = cv2.CascadeClassifier('haarcascade_frontalface_default.xml')
    FACE_CASCADE_LOADED = True
except Exception as e:
    face_cascade = None
    FACE_CASCADE_LOADED = False
    print(f"[WARN] Could not load face cascade: {e}")

# ── Constants ────────────────────────────────────────────────
EMOTION_LABELS = ['Angry', 'Disgust', 'Fear', 'Happy', 'Sad', 'Surprise', 'Neutral']

EMOTION_EMOJI = {
    'Angry':    '😠',
    'Disgust':  '🤢',
    'Fear':     '😨',
    'Happy':    '😊',
    'Sad':      '😢',
    'Surprise': '😲',
    'Neutral':  '😐',
}

# ── Flask app ────────────────────────────────────────────────
app = Flask(__name__, template_folder='templates', static_folder='static')


@app.route('/')
def index():
    return render_template('index.html', model_loaded=MODEL_LOADED)


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Accepts a base64-encoded JPEG frame from the browser,
    runs face detection + emotion prediction,
    and returns the result as JSON.
    """
    default_response = {
        'label':      'Neutral',
        'emoji':      '😐',
        'confidence': 0.0,
        'all_scores': {e: 0.0 for e in EMOTION_LABELS},
    }

    if not MODEL_LOADED or not CV2_LOADED or not FACE_CASCADE_LOADED:
        return jsonify(default_response)

    try:
        data = request.get_json(silent=True)
        if not data or 'frame' not in data:
            return jsonify(default_response)

        # Decode base64 image
        img_data = data['frame']
        if ',' in img_data:
            img_data = img_data.split(',')[1]  # strip "data:image/jpeg;base64,"

        img_bytes = base64.b64decode(img_data)
        np_arr   = np.frombuffer(img_bytes, dtype=np.uint8)
        frame    = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify(default_response)

        # Face detection
        gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)

        if len(faces) == 0:
            return jsonify(default_response)

        # Use the first detected face
        (x, y, w, h) = faces[0]
        roi_gray = gray[y:y + h, x:x + w]

        if roi_gray.size == 0:
            return jsonify(default_response)

        # Predict emotion
        roi   = cv2.resize(roi_gray, (64, 64)) / 255.0
        roi   = np.reshape(roi, (1, 64, 64, 1))
        preds = model.predict(roi, verbose=0)[0]
        idx   = int(np.argmax(preds))

        label      = EMOTION_LABELS[idx]
        confidence = float(preds[idx])
        all_scores = {EMOTION_LABELS[i]: float(preds[i]) for i in range(len(EMOTION_LABELS))}

        return jsonify({
            'label':      label,
            'emoji':      EMOTION_EMOJI.get(label, '😐'),
            'confidence': confidence,
            'all_scores': all_scores,
            'face':       [int(x), int(y), int(w), int(h)],
        })

    except Exception as e:
        print(f"[ERROR] /analyze: {e}")
        return jsonify(default_response)


# ── Entry point ──────────────────────────────────────────────
if __name__ == '__main__':
    print("\n🐰  Whack-a-Bunny + Emotion Detector starting…")
    print("   Open  http://127.0.0.1:5000  in your browser\n")
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
