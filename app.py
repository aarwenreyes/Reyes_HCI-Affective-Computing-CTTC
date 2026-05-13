import cv2
import numpy as np
import threading
import time
import json
from flask import Flask, Response, render_template, jsonify

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

# ── Constants ───────────────────────────────────────────────
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

EMOTION_COLOR = {
    'Angry':    (0,   0,   220),
    'Disgust':  (0,   140, 0  ),
    'Fear':     (128, 0,   128),
    'Happy':    (0,   200, 220),
    'Sad':      (200, 100, 0  ),
    'Surprise': (0,   180, 255),
    'Neutral':  (180, 180, 180),
}

# ── Shared state (thread-safe via lock) ─────────────────────
state_lock = threading.Lock()
current_emotion = {
    'label':      'Neutral',
    'emoji':      '😐',
    'confidence': 0.0,
    'all_scores': {e: 0.0 for e in EMOTION_LABELS},
}

# ── Camera + face detector ──────────────────────────────────
face_cascade = cv2.CascadeClassifier('haarcascade_frontalface_default.xml')
camera        = None
camera_lock   = threading.Lock()


def get_camera():
    global camera
    with camera_lock:
        if camera is None or not camera.isOpened():
            camera = cv2.VideoCapture(0)
            camera.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    return camera


def process_frame(frame):
    """Detect faces, predict emotions, draw overlays. Returns annotated frame."""
    gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)

    detected_label = 'Neutral'
    detected_conf  = 0.0
    all_scores     = {e: 0.0 for e in EMOTION_LABELS}

    for (x, y, w, h) in faces:
        roi_gray = gray[y:y + h, x:x + w]
        if roi_gray.size == 0:
            continue

        # ── Predict emotion ──
        if MODEL_LOADED:
            roi = cv2.resize(roi_gray, (64, 64)) / 255.0
            roi = np.reshape(roi, (1, 64, 64, 1))
            preds = model.predict(roi, verbose=0)[0]
            idx   = int(np.argmax(preds))
            detected_label = EMOTION_LABELS[idx]
            detected_conf  = float(preds[idx])
            all_scores     = {EMOTION_LABELS[i]: float(preds[i]) for i in range(len(EMOTION_LABELS))}
        else:
            detected_label = 'Neutral'
            detected_conf  = 1.0

        color = EMOTION_COLOR.get(detected_label, (255, 255, 255))

        # Bounding box
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)

        # Rounded label background
        label_text = f"{detected_label} {detected_conf * 100:.0f}%"
        (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)
        cv2.rectangle(frame, (x, y - th - 14), (x + tw + 8, y), color, -1)
        cv2.putText(frame, label_text, (x + 4, y - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)

        # Only use the first / largest face
        break

    # Update shared state
    with state_lock:
        current_emotion['label']      = detected_label
        current_emotion['emoji']      = EMOTION_EMOJI.get(detected_label, '😐')
        current_emotion['confidence'] = detected_conf
        current_emotion['all_scores'] = all_scores

    return frame


def generate_frames():
    """Generator for MJPEG stream."""
    cam = get_camera()
    while True:
        success, frame = cam.read()
        if not success:
            time.sleep(0.05)
            continue

        frame = cv2.flip(frame, 1)          # mirror so it feels natural
        frame = process_frame(frame)

        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if not ret:
            continue

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

        time.sleep(1 / 20)   # ~20 fps


# ── Flask app ───────────────────────────────────────────────
app = Flask(__name__, template_folder='templates', static_folder='static')


@app.route('/')
def index():
    return render_template('index.html', model_loaded=MODEL_LOADED)


@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/emotion_data')
def emotion_data():
    with state_lock:
        data = dict(current_emotion)
    return jsonify(data)


# ── Entry point ─────────────────────────────────────────────
if __name__ == '__main__':
    print("\n🐰  Whack-a-Bunny + Emotion Detector starting…")
    print("   Open  http://127.0.0.1:5000  in your browser\n")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
