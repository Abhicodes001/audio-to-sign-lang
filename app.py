from flask import Flask, request, jsonify, send_from_directory
from backend.audio_processor import process_audio
from backend.nlp_processor import process_text
from backend.sign_mapper import map_words_to_videos
import os

app = Flask(__name__, static_url_path='', static_folder='static')

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/datasets/<path:filename>')
def serve_datasets(filename):
    return send_from_directory('datasets', filename)

@app.route('/api/process-audio', methods=['POST'])
def handle_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
        
    audio_file = request.files['audio']
    
    # 1. Convert Audio to Text
    recognized_text = process_audio(audio_file)
    if not recognized_text:
        return jsonify({'error': 'Could not recognize speech. Please try speaking clearly.'}), 400
        
    # 2. NLP Process the Text
    processed_words = process_text(recognized_text)
    
    # 3. Map to Sign Language Videos
    video_sequence = map_words_to_videos(processed_words)
    
    return jsonify({
        'original_text': recognized_text,
        'processed_words': processed_words,
        'video_sequence': video_sequence
    })

if __name__ == '__main__':
    # Ensure datasets exists
    os.makedirs('datasets', exist_ok=True)
    app.run(debug=True, port=5000)
