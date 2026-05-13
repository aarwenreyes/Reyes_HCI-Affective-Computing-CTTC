# 🐰 Whack-a-Bunny + Emotion Detector

> **CS Student Project — Human & Computer Interaction**  
> An integrated system that plays the Whack-a-Bunny game while detecting the player's emotion in real time using their webcam.

---

## 📁 Project Structure

```
Whack-a-Bunny-EmotionDetector/
├── app.py                          ← Flask backend (main entry point)
├── requirements.txt                ← Python dependencies
├── model.hdf5                      ← Pre-trained emotion CNN model
├── haarcascade_frontalface_default.xml  ← OpenCV face detector
├── templates/
│   └── index.html                  ← Main page (game + emotion panel)
└── static/
    ├── style.css                   ← All styles (game + emotion panel)
    └── game.js                     ← Game logic + emotion panel JS
```

---

## ⚙️ Setup

### 1. Prerequisites
- Python 3.8 – 3.11
- A working webcam
- A modern browser (Chrome / Firefox / Edge)

### 2. Install dependencies

```bash
cd Whack-a-Bunny-EmotionDetector
pip install -r requirements.txt
```

> **Tip:** Use a virtual environment to keep dependencies isolated:
> ```bash
> python -m venv venv
> source venv/bin/activate      # macOS / Linux
> venv\Scripts\activate         # Windows
> pip install -r requirements.txt
> ```

---

## ▶️ Running the App

```bash
python app.py
```

Then open your browser at:

```
http://127.0.0.1:5000
```

---

## 🎮 How It Works

| Component | Technology | Role |
|---|---|---|
| Game (frontend) | HTML + CSS + JS | Whack-a-Bunny gameplay |
| Web server | Flask (Python) | Serves pages & video stream |
| Webcam stream | OpenCV MJPEG | Live camera feed with face bounding box |
| Face detection | Haar Cascade | Locates the player's face in each frame |
| Emotion model | Keras CNN (.hdf5) | Predicts 7 emotions from face ROI |
| Emotion poll | JS `fetch('/emotion_data')` | Updates panel every 500 ms |

### Emotion Labels
`Angry` · `Disgust` · `Fear` · `Happy` · `Sad` · `Surprise` · `Neutral`

---

## 🌟 Features

- **Live webcam panel** — displayed alongside the game with face bounding box and emotion label overlay.
- **Real-time emotion bars** — all 7 emotion confidence scores update every 0.5 s.
- **Session log** — records every emotion change during the game with a timestamp.
- **Post-game summary** — shows your dominant emotion on the Game-Over screen.
- **Graceful fallback** — if the model file isn't found or the webcam can't open, the game still works normally.

---

## 🛠 Troubleshooting

| Problem | Fix |
|---|---|
| "Could not open webcam" | Make sure no other app (Zoom, Teams) is using the camera |
| Emotion panel shows "Model not found" | Check that `model.hdf5` is in the same folder as `app.py` |
| Blank video feed | Try a different browser; Safari blocks mixed-content streams |
| Slow frame rate | Lower `cv2.CAP_PROP_FRAME_WIDTH/HEIGHT` in `app.py` |
| TensorFlow import error | Install compatible version: `pip install tensorflow==2.12` |

---

## 📜 Credits

- **Whack-a-Bunny game** — original by Reyes (HCI project)  
- **Emotion Detector** — original by Reyes (HCI project)  
- **Integration** — combined into a single Flask application
